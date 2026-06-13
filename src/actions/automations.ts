'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  enrollContactInAutomation,
  processDueEmails,
} from '@/features/automations/services/email-engine'
import { getActiveAutomationForForm } from '@/features/automations/services/queries'
import type { AutomationStatus, DelayUnit } from '@/types/database'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ─── Formularios ─────────────────────────────────────────────────────────────
const formSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
})

export async function createForm(formData: FormData) {
  const parsed = formSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('forms')
    .insert({ name: d.name, slug: d.slug ? slugify(d.slug) : slugify(d.name), description: d.description || null })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un formulario con ese enlace (slug)' }
    return { error: error.message }
  }
  revalidatePath('/automations')
  return { success: true, id: data.id }
}

export async function updateForm(id: string, formData: FormData) {
  const parsed = formSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const d = parsed.data
  const supabase = await createClient()
  const update: Record<string, unknown> = {
    name: d.name,
    description: d.description || null,
    updated_at: new Date().toISOString(),
  }
  if (d.slug) update.slug = slugify(d.slug)
  const { error } = await supabase.from('forms').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un formulario con ese enlace (slug)' }
    return { error: error.message }
  }
  revalidatePath('/automations')
  revalidatePath(`/automations/forms/${id}`)
  return { success: true }
}

export async function deleteForm(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/automations')
  return { success: true }
}

// ─── Automatizaciones ──────────────────────────────────────────────────────────
export async function createAutomation(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'El nombre es obligatorio' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('automations').insert({ name }).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/automations')
  return { success: true, id: data.id }
}

export async function renameAutomation(id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/automations/${id}`)
  return { success: true }
}

export async function setAutomationStatus(id: string, status: AutomationStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('automations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/automations')
  revalidatePath(`/automations/${id}`)
  return { success: true }
}

export async function deleteAutomation(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('automations').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/automations')
  return { success: true }
}

export async function setAutomationTriggers(automationId: string, formIds: string[]) {
  const supabase = await createClient()
  await supabase.from('automation_triggers').delete().eq('automation_id', automationId)
  if (formIds.length > 0) {
    const { error } = await supabase
      .from('automation_triggers')
      .insert(formIds.map((form_id) => ({ automation_id: automationId, form_id })))
    if (error) return { error: error.message }
  }
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

// ─── Pasos ────────────────────────────────────────────────────────────────────
export async function addStep(automationId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('automation_steps')
    .select('*', { count: 'exact', head: true })
    .eq('automation_id', automationId)
  const { error } = await supabase.from('automation_steps').insert({
    automation_id: automationId,
    position: count ?? 0,
    delay_value: count === 0 ? 0 : 2,
    delay_unit: 'days',
    subject: 'Asunto del email',
    body: 'Escribe aquí tu mensaje.',
  })
  if (error) return { error: error.message }
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

const stepPatch = z.object({
  delay_value: z.coerce.number().int().min(0).max(365).optional(),
  delay_unit: z.enum(['days', 'hours']).optional(),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().max(8000).optional(),
})

export async function updateStep(
  id: string,
  automationId: string,
  patch: { delay_value?: number; delay_unit?: DelayUnit; subject?: string; body?: string }
) {
  const parsed = stepPatch.safeParse(patch)
  if (!parsed.success) return { error: 'Datos inválidos' }
  const supabase = await createClient()
  const { error } = await supabase.from('automation_steps').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

export async function deleteStep(id: string, automationId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('automation_steps').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

// ─── Envío público del formulario (service-role) ─────────────────────────────
const submitSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  email: z.string().trim().email('Email inválido'),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
})

export async function submitPublicForm(formData: FormData) {
  const parsed = submitSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    message: formData.get('message'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { slug, name, email, phone, message } = parsed.data

  const admin = createAdminClient()
  const { data: form } = await admin.from('forms').select('id, name').eq('slug', slug).single()
  if (!form) return { error: 'Formulario no encontrado' }

  // Dedup contacto por email (patrón createPublicBooking)
  let contactId: string | null = null
  const { data: found } = await admin
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  if (found) {
    contactId = found.id
    await admin
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString(), phone: phone || undefined })
      .eq('id', contactId)
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const { data: nc } = await admin
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: rest.join(' ') || null,
        email,
        phone: phone || null,
        source: 'form',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    contactId = nc?.id ?? null
  }

  if (contactId) {
    await admin.from('contact_activities').insert({
      contact_id: contactId,
      type: 'form_submitted',
      description: `Formulario: ${form.name}`,
      metadata: message ? { message } : {},
    })
  }

  // Inscribe en la automatización activa vinculada (si la hay)
  const automationId = await getActiveAutomationForForm(form.id)
  if (automationId && contactId) {
    const n = await enrollContactInAutomation(admin, automationId, contactId, email)
    if (n > 0) {
      await admin.from('contact_activities').insert({
        contact_id: contactId,
        type: 'enrolled',
        description: 'Inscrito en secuencia de emails',
        metadata: { automation_id: automationId },
      })
      // Envía los pasos de día 0 al instante (no bloquea si falla)
      try {
        await processDueEmails(admin)
      } catch {
        /* el contacto ya está guardado; no romper la respuesta */
      }
    }
  }

  revalidatePath('/contacts')
  return { success: true }
}
