import { query, queryOne } from '@/lib/db'
import { fireTrigger } from '@/features/automations/services/engine'
import { processDueEmails } from '@/features/automations/services/email-engine'
import { listCampaigns } from '@/features/marketing/services/queries'
import { allBlocks, migrateDesign } from '@/features/marketing/services/design'
import { listContacts } from '@/features/contacts/services/contacts'
import type { Contact, ContactActivity, EmailBlock, EmailCampaign } from '@/types/database'

/**
 * Capa de datos del CRM compartida por el Asistente IA del panel (tools.ts)
 * y el servidor MCP (/api/mcp). Todos los resultados son JSON puro (fechas → iso()).
 * Las escrituras pasan por los mismos caminos que la UI: etiquetar dispara
 * los triggers 'tag_added' de automatizaciones.
 */

const ACTIVITY_LABELS: Record<string, string> = {
  imported: 'Importado del CSV',
  booking_created: 'Reservó una cita',
  email_sent: 'Se le envió un email',
  form_submitted: 'Envió un formulario',
  enrolled: 'Inscrito en secuencia',
  tag_added: 'Etiqueta añadida',
  note: 'Nota',
}

/** pg devuelve timestamptz como Date; la frontera de tools exige JSON puro. */
export function iso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function contactName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Sin nombre'
}

export function contactSummary(c: Contact) {
  return {
    id: c.id,
    nombre: contactName(c),
    email: c.email,
    telefono: c.phone,
    empresa: c.business_name,
    etiquetas: c.tags,
    dado_de_baja: Boolean(c.unsubscribed_at),
    ultima_actividad: iso(c.last_activity_at),
    creado: iso(c.created_at),
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resuelve un contacto por id (uuid) o por email exacto. */
export async function findContactByRef(ref: string): Promise<Contact | null> {
  const clean = ref.trim()
  if (UUID_RE.test(clean)) {
    return queryOne<Contact>('select * from contacts where id = $1', [clean])
  }
  return queryOne<Contact>('select * from contacts where lower(email) = lower($1)', [clean])
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function audienceSummary() {
  const totals = await queryOne<{ total: number; bajas: number }>(
    'select count(*)::int as total, count(unsubscribed_at)::int as bajas from contacts'
  )
  const tags = await query<{ tag: string; n: number }>(
    'select unnest(tags) as tag, count(*)::int as n from contacts group by tag order by n desc limit 30'
  )
  return {
    total_contactos: totals?.total ?? 0,
    dados_de_baja: totals?.bajas ?? 0,
    etiquetas: tags.map((t) => ({ etiqueta: t.tag, contactos: t.n })),
  }
}

export async function searchContacts(input: { consulta?: string; etiqueta?: string }) {
  const contacts = await listContacts({ search: input.consulta, tag: input.etiqueta })
  return { total: contacts.length, contactos: contacts.slice(0, 20).map(contactSummary) }
}

export async function contactCard(consulta: string) {
  const matches = await listContacts({ search: consulta })
  if (matches.length === 0) return { error: `No hay ningún contacto que encaje con "${consulta}"` }
  if (matches.length > 5) {
    return {
      error: `Hay ${matches.length} contactos que encajan. Afina la búsqueda.`,
      coincidencias: matches.slice(0, 5).map((c) => ({ nombre: contactName(c), email: c.email })),
    }
  }
  const exact = matches.find((c) => c.email?.toLowerCase() === consulta.toLowerCase())
  const contact = exact ?? matches[0]
  const activities = await query<ContactActivity>(
    'select * from contact_activities where contact_id = $1 order by created_at desc limit 10',
    [contact.id]
  )
  return {
    contacto: contactSummary(contact),
    ultimas_interacciones: activities.map((a) => ({
      tipo: ACTIVITY_LABELS[a.type] ?? a.type,
      detalle: a.description,
      fecha: iso(a.created_at),
    })),
    ...(matches.length > 1
      ? { nota: `Había ${matches.length} coincidencias; se muestra la más probable.` }
      : {}),
  }
}

export async function campaignList() {
  const campaigns = await listCampaigns()
  return {
    total: campaigns.length,
    campanas: campaigns.slice(0, 25).map((c) => ({
      id: c.id,
      nombre: c.name,
      asunto: c.subject,
      estado: c.status,
      destinatarios: c.recipients,
      enviados: c.sent,
      clicks: c.clicks,
      actualizada: iso(c.updated_at),
    })),
  }
}

export async function campaignContent(id: string) {
  const campaign = await queryOne<EmailCampaign>('select * from email_campaigns where id = $1', [id])
  if (!campaign) return { error: 'No existe esa campaña' }
  const blocks = allBlocks(migrateDesign(campaign.design))
  const contenido = blocks
    .map((b: EmailBlock) => {
      if (b.type === 'header') return b.config.title ? `[Cabecera] ${b.config.title}` : ''
      if (b.type === 'text') return b.config.html ? stripTags(b.config.html) : (b.config.text ?? '')
      if (b.type === 'button') return `[Botón] ${b.config.label ?? ''} → ${b.config.url ?? ''}`
      if (b.type === 'footer') return b.config.footer_text ? `[Pie] ${b.config.footer_text}` : ''
      return `[Bloque: ${b.type}]`
    })
    .filter(Boolean)
  return { nombre: campaign.name, asunto: campaign.subject, estado: campaign.status, contenido }
}

// ── Escrituras seguras (mismo camino que la UI) ─────────────────────────────

/**
 * Añade una etiqueta a un contacto y dispara los workflows con trigger
 * 'tag_added' (igual que editar el contacto en la UI). No duplica etiquetas.
 */
export async function addTagToContact(ref: string, etiqueta: string) {
  const contact = await findContactByRef(ref)
  if (!contact) return { error: `No existe el contacto "${ref}" (usa id o email exacto)` }
  const tag = etiqueta.trim()
  if (!tag) return { error: 'Etiqueta vacía' }
  if (contact.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    return { hecho: false, motivo: 'El contacto ya tiene esa etiqueta', etiquetas: contact.tags }
  }
  const updated = await queryOne<{ tags: string[] }>(
    `update contacts set tags = array_append(tags, $1), updated_at = now(),
       last_activity_at = now() where id = $2 returning tags`,
    [tag, contact.id]
  )
  await query(
    `insert into contact_activities (contact_id, type, description) values ($1, 'tag_added', $2)`,
    [contact.id, `Etiqueta "${tag}" añadida por el agente`]
  )
  let workflows_disparados = 0
  try {
    workflows_disparados = await fireTrigger('tag_added', { tag }, contact.id, contact.email)
    if (workflows_disparados > 0) await processDueEmails()
  } catch {
    /* la etiqueta ya está puesta; no romper la respuesta */
  }
  return { hecho: true, contacto: contactName(contact), etiquetas: updated?.tags, workflows_disparados }
}

export async function removeTagFromContact(ref: string, etiqueta: string) {
  const contact = await findContactByRef(ref)
  if (!contact) return { error: `No existe el contacto "${ref}" (usa id o email exacto)` }
  const existing = contact.tags.find((t) => t.toLowerCase() === etiqueta.trim().toLowerCase())
  if (!existing) {
    return { hecho: false, motivo: 'El contacto no tiene esa etiqueta', etiquetas: contact.tags }
  }
  const updated = await queryOne<{ tags: string[] }>(
    `update contacts set tags = array_remove(tags, $1), updated_at = now() where id = $2 returning tags`,
    [existing, contact.id]
  )
  return { hecho: true, contacto: contactName(contact), etiquetas: updated?.tags }
}

export async function addNoteToContact(ref: string, texto: string) {
  const contact = await findContactByRef(ref)
  if (!contact) return { error: `No existe el contacto "${ref}" (usa id o email exacto)` }
  const nota = texto.trim()
  if (!nota) return { error: 'Nota vacía' }
  await query(
    `insert into contact_activities (contact_id, type, description) values ($1, 'note', $2)`,
    [contact.id, nota.slice(0, 2000)]
  )
  await query(`update contacts set last_activity_at = now() where id = $1`, [contact.id])
  return { hecho: true, contacto: contactName(contact) }
}
