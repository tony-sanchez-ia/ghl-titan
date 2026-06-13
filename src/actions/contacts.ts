'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseGhlCsv } from '@/features/contacts/services/csv-import'

const contactSchema = z.object({
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('Email inválido').or(z.literal('')).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  business_name: z.string().trim().max(160).optional().nullable(),
  tags: z.string().optional().nullable(), // coma-separados desde el form
})

function parseTagsInput(value: string | null | undefined): string[] {
  if (!value) return []
  return Array.from(
    new Set(
      value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    )
  )
}

function emptyToNull(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

export async function createContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    business_name: formData.get('business_name'),
    tags: formData.get('tags'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      first_name: emptyToNull(parsed.data.first_name),
      last_name: emptyToNull(parsed.data.last_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      business_name: emptyToNull(parsed.data.business_name),
      tags: parseTagsInput(parsed.data.tags),
      source: 'manual',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('contact_activities').insert({
    contact_id: data.id,
    type: 'note',
    description: 'Contacto creado manualmente',
    metadata: {},
  })

  revalidatePath('/contacts')
  return { success: true, id: data.id }
}

export async function updateContact(id: string, formData: FormData) {
  const parsed = contactSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    business_name: formData.get('business_name'),
    tags: formData.get('tags'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({
      first_name: emptyToNull(parsed.data.first_name),
      last_name: emptyToNull(parsed.data.last_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      business_name: emptyToNull(parsed.data.business_name),
      tags: parseTagsInput(parsed.data.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)
  return { success: true }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true }
}

export async function importContactsFromCsv(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { error: 'No se recibió ningún archivo' }
  }

  const content = await file.text()
  const { rows, errors } = parseGhlCsv(content)

  if (rows.length === 0) {
    return { error: 'El CSV no contiene contactos válidos', importErrors: errors }
  }

  const supabase = await createClient()

  // Determina cuáles ya existen (dedup por ghl_contact_id) para contar nuevos vs actualizados.
  const ghlIds = rows.map((r) => r.ghl_contact_id).filter((v): v is string => !!v)
  const { data: existing } = await supabase
    .from('contacts')
    .select('ghl_contact_id')
    .in('ghl_contact_id', ghlIds)
  const existingSet = new Set((existing ?? []).map((e) => e.ghl_contact_id))

  // Upsert por ghl_contact_id.
  const payload = rows.map((r) => ({
    ghl_contact_id: r.ghl_contact_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    business_name: r.business_name,
    tags: r.tags,
    last_activity_at: r.last_activity_at,
    source: 'ghl_import',
    updated_at: new Date().toISOString(),
  }))

  const { data: upserted, error } = await supabase
    .from('contacts')
    .upsert(payload, { onConflict: 'ghl_contact_id' })
    .select('id, ghl_contact_id')

  if (error) return { error: error.message, importErrors: errors }

  // Registra actividad 'imported' solo para los nuevos.
  const newActivities = (upserted ?? [])
    .filter((c) => c.ghl_contact_id && !existingSet.has(c.ghl_contact_id))
    .map((c) => ({
      contact_id: c.id,
      type: 'imported' as const,
      description: 'Importado desde GoHighLevel',
      metadata: {},
    }))

  if (newActivities.length > 0) {
    await supabase.from('contact_activities').insert(newActivities)
  }

  revalidatePath('/contacts')
  revalidatePath('/dashboard')

  return {
    success: true,
    total: rows.length,
    newCount: rows.length - existingSet.size,
    updateCount: existingSet.size,
    importErrors: errors,
  }
}
