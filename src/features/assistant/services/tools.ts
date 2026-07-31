import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { uid } from '@/shared/lib/uid'
import {
  DEFAULT_STYLES,
  allBlocks,
  migrateDesign,
  newSection,
} from '@/features/marketing/services/design'
import { listCampaigns } from '@/features/marketing/services/queries'
import { listContacts } from '@/features/contacts/services/contacts'
import { addMemoryEntry, memoryExists } from './memory'
import type {
  Contact,
  ContactActivity,
  EmailBlock,
  EmailCampaign,
  EmailDesign,
} from '@/types/database'

/**
 * Herramientas del Asistente IA (Vercel AI SDK `tool()` + zod).
 * Solo lectura sobre contactos/campañas + creación de BORRADORES.
 * No existe (a propósito) ninguna herramienta de envío.
 */

const ACTIVITY_LABELS: Record<string, string> = {
  imported: 'Importado del CSV',
  booking_created: 'Reservó una cita',
  email_sent: 'Se le envió un email',
  form_submitted: 'Envió un formulario',
  enrolled: 'Inscrito en secuencia',
}

function contactName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Sin nombre'
}

/** pg devuelve timestamptz como Date; los resultados de tools deben ser JSON puro. */
function iso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function contactSummary(c: Contact) {
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

export const assistantTools = {
  resumen_audiencia: tool({
    description:
      'Resumen de la audiencia: total de contactos, bajas, y etiquetas con cuántos contactos tiene cada una. Úsala para segmentar o dimensionar una newsletter.',
    inputSchema: z.object({}),
    execute: async () => {
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
    },
  }),

  buscar_contactos: tool({
    description:
      'Busca contactos por texto (nombre, email, teléfono o empresa) y/o por etiqueta. Devuelve hasta 20 resultados y el total.',
    inputSchema: z.object({
      consulta: z.string().max(200).optional().describe('Texto a buscar (nombre, email, empresa…)'),
      etiqueta: z.string().max(100).optional().describe('Filtrar por una etiqueta exacta'),
    }),
    execute: async ({ consulta, etiqueta }) => {
      const contacts = await listContacts({ search: consulta, tag: etiqueta })
      return {
        total: contacts.length,
        contactos: contacts.slice(0, 20).map(contactSummary),
      }
    },
  }),

  ver_contacto: tool({
    description:
      'Ficha completa de UN contacto: datos, etiquetas y sus últimas interacciones (citas, emails, formularios). Busca por email o nombre.',
    inputSchema: z.object({
      consulta: z.string().min(2).max(200).describe('Email o nombre del contacto'),
    }),
    execute: async ({ consulta }) => {
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
    },
  }),

  listar_campanas: tool({
    description:
      'Lista las campañas/newsletters existentes con su estado y estadísticas (destinatarios, enviados, clicks). Útil para ver qué se ha mandado ya y qué funcionó.',
    inputSchema: z.object({}),
    execute: async () => {
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
    },
  }),

  ver_campana: tool({
    description:
      'Contenido completo de una campaña (por id de listar_campanas): asunto y texto de todos sus bloques. Úsala para estudiar el copy de campañas anteriores.',
    inputSchema: z.object({
      id: z.string().uuid().describe('El id de la campaña'),
    }),
    execute: async ({ id }) => {
      const campaign = await queryOne<EmailCampaign>(
        'select * from email_campaigns where id = $1',
        [id]
      )
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
      return {
        nombre: campaign.name,
        asunto: campaign.subject,
        estado: campaign.status,
        contenido,
      }
    },
  }),

  crear_borrador_newsletter: tool({
    description:
      'Crea un BORRADOR de newsletter real en Marketing → Campañas (nunca lo envía). Recibe el copy como bloques de texto plano en orden. Devuelve la ruta donde revisarlo.',
    inputSchema: z.object({
      nombre: z.string().min(1).max(160).describe('Nombre interno de la campaña'),
      asunto: z.string().min(1).max(200).describe('Asunto del email'),
      bloques: z
        .array(
          z.object({
            tipo: z.enum(['titular', 'texto', 'boton']),
            texto: z.string().min(1).max(4000).describe('Contenido en texto plano (sin HTML ni markdown)'),
            url: z.string().max(1000).optional().describe('Enlace del botón (solo tipo boton)'),
          })
        )
        .min(1)
        .max(20),
    }),
    execute: async ({ nombre, asunto, bloques }) => {
      const emailBlocks: EmailBlock[] = [
        { id: uid(), type: 'header', config: { title: 'GHL Titan' } },
        ...bloques.map((b): EmailBlock => {
          if (b.tipo === 'boton') {
            return {
              id: uid(),
              type: 'button',
              config: { label: b.texto.slice(0, 200), url: b.url ?? '', align: 'center' },
            }
          }
          return {
            id: uid(),
            type: 'text',
            config: { text: b.texto, size: b.tipo === 'titular' ? 'title' : 'normal', align: 'left' },
          }
        }),
        { id: uid(), type: 'footer', config: { footer_text: 'GHL Titan · Titanic Factory' } },
      ]
      const design: EmailDesign = {
        version: 2,
        styles: { ...DEFAULT_STYLES },
        sections: [newSection('1', emailBlocks)],
      }
      const row = await queryOne<{ id: string }>(
        `insert into email_campaigns (name, subject, design, status)
         values ($1, $2, $3, 'draft') returning id`,
        [nombre, asunto, JSON.stringify(design)]
      )
      return {
        creado: true,
        id: row!.id,
        ruta: `/marketing/campaigns/${row!.id}`,
        nota: 'Borrador creado. Tony puede retocarlo en el editor visual y enviarlo desde Marketing.',
      }
    },
  }),

  guardar_memoria: tool({
    description:
      'Guarda en la memoria de marca un dato duradero aprendido en la conversación (tono, público, ofertas, preferencias, qué funcionó). Una frase corta y autocontenida.',
    inputSchema: z.object({
      dato: z.string().min(4).max(500).describe('El dato a recordar, en una frase'),
    }),
    execute: async ({ dato }) => {
      if (await memoryExists(dato)) return { guardado: false, motivo: 'Ya estaba en la memoria' }
      await addMemoryEntry(dato, 'agent')
      return { guardado: true }
    },
  }),
}
