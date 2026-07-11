'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { getFormBySlug } from '@/features/forms/services/queries'
import { validateSubmission } from '@/features/forms/services/validation'
import { sanitizeInlineHtml } from '@/shared/lib/sanitize'
import { fireTrigger } from '@/features/automations/services/engine'
import { processDueEmails } from '@/features/automations/services/email-engine'
import type { FormSchema, FormSettings, FormStyles } from '@/types/database'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

export interface SubmitResult {
  error?: string
  action?: 'message' | 'redirect'
  message_html?: string
  redirect_url?: string
}

/** Campos reservados extraídos del envío para poblar la ficha del contacto. */
function contactFieldsFromData(data: Record<string, unknown>): {
  first_name: string | null
  last_name: string | null
  phone: string | null
  business_name: string | null
} {
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string).trim() : '')

  let first = str('first_name') || null
  let last = str('last_name') || null
  const full = str('full_name')
  if (full && !first) {
    const [f, ...rest] = full.split(/\s+/)
    first = f || null
    last = last || (rest.join(' ') || null)
  }
  return {
    first_name: first,
    last_name: last,
    phone: str('phone') || null,
    business_name: str('business_name') || null,
  }
}

function isSafeRedirect(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim())
}

/**
 * Envío público de un formulario (desde /form/[slug], iframe embebido o funnel).
 * Crea/actualiza el contacto (dedup por email), guarda el envío crudo, aplica
 * etiquetas y dispara las automatizaciones. Nunca revienta el envío por un fallo
 * secundario (tags/automatizaciones): el lead ya quedó guardado.
 */
export async function submitForm(input: {
  slug: string
  values: Record<string, unknown>
  visitorId?: string | null
}): Promise<SubmitResult> {
  const form = await getFormBySlug(input.slug)
  if (!form) return { error: 'Formulario no encontrado' }

  const validated = validateSubmission(form.schema, input.values ?? {})
  if (!validated.ok) return { error: validated.error }
  const { data, email } = validated.result

  // ── Contacto: dedup por email o alta nueva ──
  const cf = contactFieldsFromData(data)
  let contactId: string
  const found = await queryOne<{ id: string }>(
    'select id from contacts where email ilike $1 limit 1',
    [email]
  )
  if (found) {
    contactId = found.id
    await query(
      `update contacts set
         last_activity_at = now(),
         first_name    = coalesce(first_name, $1),
         last_name     = coalesce(last_name, $2),
         phone         = coalesce($3, phone),
         business_name = coalesce($4, business_name)
       where id = $5`,
      [cf.first_name, cf.last_name, cf.phone, cf.business_name, contactId]
    )
  } else {
    const nc = await queryOne<{ id: string }>(
      `insert into contacts (first_name, last_name, email, phone, business_name, source, last_activity_at)
       values ($1, $2, $3, $4, $5, 'form', now()) returning id`,
      [cf.first_name, cf.last_name, email, cf.phone, cf.business_name]
    )
    contactId = nc!.id
  }

  // ── Etiquetas del formulario (solo las nuevas disparan tag_added) ──
  const newTags: string[] = []
  for (const tag of form.settings.add_tags ?? []) {
    const t = tag.trim()
    if (!t) continue
    const updated = await queryOne<{ id: string }>(
      `update contacts set tags = array_append(tags, $1), updated_at = now()
       where id = $2 and not (tags @> array[$1]) returning id`,
      [t, contactId]
    )
    if (updated) newTags.push(t)
  }

  // ── Envío crudo + actividad en el timeline ──
  await query(
    `insert into form_submissions (form_id, contact_id, data, visitor_id) values ($1, $2, $3, $4)`,
    [form.id, contactId, JSON.stringify(data), input.visitorId || null]
  )
  await query(
    `insert into contact_activities (contact_id, type, description, metadata)
     values ($1, 'form_submitted', $2, $3)`,
    [contactId, `Formulario: ${form.name}`, JSON.stringify({ form_id: form.id, data })]
  )

  // ── Automatizaciones (nunca rompen la respuesta) ──
  try {
    await fireTrigger('form_submitted', { formId: form.id }, contactId, email)
    for (const tag of newTags) await fireTrigger('tag_added', { tag }, contactId, email)
    await processDueEmails()
  } catch {
    /* el contacto y el envío ya están guardados */
  }

  revalidatePath('/contacts')

  if (form.settings.submit_action === 'redirect' && isSafeRedirect(form.settings.redirect_url)) {
    return { action: 'redirect', redirect_url: form.settings.redirect_url.trim() }
  }
  return {
    action: 'message',
    message_html:
      form.settings.message_html || '<p>¡Gracias! Hemos recibido tus datos.</p>',
  }
}

// ─── CRUD / editor (admin) ────────────────────────────────────────────────────

export async function createForm(name: string): Promise<{ id?: string; error?: string }> {
  const n = name.trim()
  if (!n) return { error: 'El nombre es obligatorio' }
  try {
    const row = await queryOne<{ id: string }>(
      'insert into forms (name, slug) values ($1, $2) returning id',
      [n, `${slugify(n) || 'formulario'}-${Math.random().toString(36).slice(2, 7)}`]
    )
    revalidatePath('/forms')
    return { id: row!.id }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function updateFormMeta(
  id: string,
  input: { name?: string; slug?: string }
): Promise<{ success?: boolean; error?: string }> {
  const name = input.name?.trim()
  if (input.name !== undefined && !name) return { error: 'El nombre no puede estar vacío' }
  const slug = input.slug !== undefined ? slugify(input.slug) : undefined
  if (input.slug !== undefined && !slug) return { error: 'El enlace (slug) no es válido' }
  try {
    await query(
      `update forms set
         name = coalesce($1, name),
         slug = coalesce($2, slug),
         updated_at = now()
       where id = $3`,
      [name ?? null, slug ?? null, id]
    )
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un formulario con ese enlace (slug)' }
    return { error: (err as Error).message }
  }
  revalidatePath('/forms')
  revalidatePath(`/forms/${id}`)
  return { success: true }
}

// Validación de estructura del diseño (admin autenticado; el html se sanea aparte)
const fieldSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum([
    'text', 'textarea', 'email', 'phone', 'number', 'date',
    'select', 'radio', 'checkbox_group', 'consent',
    'heading', 'paragraph', 'hidden',
  ]),
  key: z.string().min(1).max(60),
  label: z.string().max(300),
  placeholder: z.string().max(300).optional(),
  help: z.string().max(500).optional(),
  required: z.boolean().optional(),
  width: z.enum(['full', 'half']),
  options: z.array(z.object({ label: z.string().max(200), value: z.string().max(200) })).max(50).optional(),
  content_html: z.string().max(5000).optional(),
  default_value: z.string().max(1000).optional(),
})
const schemaSchema = z.object({ version: z.literal(1), fields: z.array(fieldSchema).max(100) })
const stylesSchema = z.object({
  theme: z.enum(['clean', 'card', 'minimal']),
  background_color: z.string().max(32),
  text_color: z.string().max(32),
  button_color: z.string().max(32),
  button_text_color: z.string().max(32),
  border_color: z.string().max(32),
  border_width: z.number().min(0).max(20),
  border_radius: z.number().min(0).max(80),
  field_radius: z.number().min(0).max(80),
  width: z.number().min(240).max(1200),
  label_align: z.enum(['top', 'left']),
})
const settingsSchema = z.object({
  submit_label: z.string().max(60),
  submit_action: z.enum(['message', 'redirect']),
  message_html: z.string().max(20000).optional(),
  redirect_url: z.string().max(500).optional(),
  add_tags: z.array(z.string().trim().max(60)).max(30),
})

export async function saveFormDesign(
  id: string,
  design: { schema: FormSchema; styles: FormStyles; settings: FormSettings }
): Promise<{ success?: boolean; error?: string }> {
  const s = schemaSchema.safeParse(design.schema)
  const st = stylesSchema.safeParse(design.styles)
  const se = settingsSchema.safeParse(design.settings)
  if (!s.success || !st.success || !se.success) return { error: 'Diseño inválido' }

  // Sanear el HTML que se renderiza en público (párrafos + mensaje de gracias)
  const cleanSchema: FormSchema = {
    version: 1,
    fields: s.data.fields.map((f) =>
      f.type === 'paragraph'
        ? { ...f, content_html: sanitizeInlineHtml(f.content_html ?? '') }
        : f
    ),
  }
  const cleanSettings: FormSettings = {
    ...se.data,
    add_tags: se.data.add_tags.map((t) => t.trim()).filter(Boolean),
    message_html: se.data.message_html ? sanitizeInlineHtml(se.data.message_html) : '',
  }

  await query(
    `update forms set schema = $1, styles = $2, settings = $3, updated_at = now() where id = $4`,
    [JSON.stringify(cleanSchema), JSON.stringify(st.data), JSON.stringify(cleanSettings), id]
  )
  revalidatePath(`/forms/${id}`)
  revalidatePath('/forms')
  return { success: true }
}

export async function setFormStatus(
  id: string,
  status: 'draft' | 'published'
): Promise<{ success?: boolean; error?: string }> {
  await query('update forms set status = $1, updated_at = now() where id = $2', [status, id])
  revalidatePath('/forms')
  revalidatePath(`/forms/${id}`)
  return { success: true }
}

export async function deleteForm(id: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from forms where id = $1', [id])
  revalidatePath('/forms')
  return { success: true }
}

/**
 * Vincula/desvincula el formulario con una automatización creando o quitando su
 * disparador `form_submitted`. Fuente de verdad única: automation_trigger_defs
 * (el mismo mecanismo que la sección Automatizaciones).
 */
export async function toggleFormAutomation(
  formId: string,
  automationId: string,
  link: boolean
): Promise<{ success?: boolean; error?: string }> {
  if (link) {
    const exists = await queryOne<{ id: string }>(
      `select id from automation_trigger_defs
       where automation_id = $1 and type = 'form_submitted' and config->>'form_id' = $2 limit 1`,
      [automationId, formId]
    )
    if (!exists) {
      await query(
        `insert into automation_trigger_defs (automation_id, type, config)
         values ($1, 'form_submitted', $2)`,
        [automationId, JSON.stringify({ form_id: formId })]
      )
    }
  } else {
    await query(
      `delete from automation_trigger_defs
       where automation_id = $1 and type = 'form_submitted' and config->>'form_id' = $2`,
      [automationId, formId]
    )
  }
  revalidatePath(`/forms/${formId}`)
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}
