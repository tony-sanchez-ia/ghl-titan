'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { parseGhlCsv } from '@/features/contacts/services/csv-import'
import { fireTrigger } from '@/features/automations/services/engine'
import { processDueEmails } from '@/features/automations/services/email-engine'

/** Dispara los workflows "etiqueta añadida" para las etiquetas NUEVAS (no bloquea). */
async function fireTagTriggers(contactId: string, email: string | null, newTags: string[]) {
  if (newTags.length === 0) return
  try {
    let fired = 0
    for (const tag of newTags) {
      fired += await fireTrigger('tag_added', { tag }, contactId, email)
    }
    if (fired > 0) await processDueEmails()
  } catch {
    /* el contacto ya está guardado; no romper la respuesta */
  }
}

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

  const data = await queryOne<{ id: string }>(
    `insert into contacts (first_name, last_name, email, phone, business_name, tags, source)
     values ($1, $2, $3, $4, $5, $6, 'manual') returning id`,
    [
      emptyToNull(parsed.data.first_name),
      emptyToNull(parsed.data.last_name),
      emptyToNull(parsed.data.email),
      emptyToNull(parsed.data.phone),
      emptyToNull(parsed.data.business_name),
      parseTagsInput(parsed.data.tags),
    ]
  )
  if (!data) return { error: 'No se pudo crear el contacto' }

  await query(
    `insert into contact_activities (contact_id, type, description, metadata)
     values ($1, 'note', 'Contacto creado manualmente', '{}')`,
    [data.id]
  )

  await fireTagTriggers(data.id, emptyToNull(parsed.data.email), parseTagsInput(parsed.data.tags))

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

  const before = await queryOne<{ tags: string[] }>(
    'select tags from contacts where id = $1',
    [id]
  )
  const nextTags = parseTagsInput(parsed.data.tags)

  await query(
    `update contacts set first_name = $1, last_name = $2, email = $3, phone = $4,
       business_name = $5, tags = $6, updated_at = now()
     where id = $7`,
    [
      emptyToNull(parsed.data.first_name),
      emptyToNull(parsed.data.last_name),
      emptyToNull(parsed.data.email),
      emptyToNull(parsed.data.phone),
      emptyToNull(parsed.data.business_name),
      nextTags,
      id,
    ]
  )

  // Solo las etiquetas realmente NUEVAS disparan workflows
  const prev = new Set((before?.tags ?? []).map((t) => t.toLowerCase()))
  const added = nextTags.filter((t) => !prev.has(t.toLowerCase()))
  await fireTagTriggers(id, emptyToNull(parsed.data.email), added)

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)
  return { success: true }
}

export async function deleteContact(id: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from contacts where id = $1', [id])
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

  // Determina cuáles ya existen (dedup por ghl_contact_id) para contar nuevos vs actualizados.
  const ghlIds = rows.map((r) => r.ghl_contact_id).filter((v): v is string => !!v)
  const existing = await query<{ ghl_contact_id: string }>(
    'select ghl_contact_id from contacts where ghl_contact_id = any($1)',
    [ghlIds]
  )
  const existingSet = new Set(existing.map((e) => e.ghl_contact_id))

  // Upsert por ghl_contact_id, fila a fila (volumen pequeño: ~200 contactos).
  const newIds: string[] = []
  for (const r of rows) {
    const upserted = await queryOne<{ id: string; ghl_contact_id: string | null }>(
      `insert into contacts (ghl_contact_id, first_name, last_name, email, phone, business_name, tags, last_activity_at, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'ghl_import')
       on conflict (ghl_contact_id) do update set
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         email = excluded.email,
         phone = excluded.phone,
         business_name = excluded.business_name,
         tags = excluded.tags,
         last_activity_at = excluded.last_activity_at,
         updated_at = now()
       returning id, ghl_contact_id`,
      [
        r.ghl_contact_id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.business_name,
        r.tags,
        r.last_activity_at,
      ]
    )
    if (upserted?.ghl_contact_id && !existingSet.has(upserted.ghl_contact_id)) {
      newIds.push(upserted.id)
    }
  }

  // Registra actividad 'imported' solo para los nuevos.
  if (newIds.length > 0) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       select unnest($1::uuid[]), 'imported', 'Importado desde GoHighLevel', '{}'`,
      [newIds]
    )
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
