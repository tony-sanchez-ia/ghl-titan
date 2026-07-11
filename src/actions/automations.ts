'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { processDueEmails } from '@/features/automations/services/email-engine'
import { fireTrigger } from '@/features/automations/services/engine'
import type { AutomationStatus, NodeBranch, NodeType, TriggerType } from '@/types/database'

// ─── Automatizaciones ──────────────────────────────────────────────────────────
export async function createAutomation(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'El nombre es obligatorio' }
  const data = await queryOne<{ id: string }>(
    'insert into automations (name) values ($1) returning id',
    [name]
  )
  revalidatePath('/automations')
  return { success: true, id: data!.id }
}

export async function renameAutomation(id: string, name: string): Promise<{ success?: boolean; error?: string }> {
  await query('update automations set name = $1, updated_at = now() where id = $2', [name, id])
  revalidatePath(`/automations/${id}`)
  return { success: true }
}

export async function setAutomationStatus(id: string, status: AutomationStatus): Promise<{ success?: boolean; error?: string }> {
  await query('update automations set status = $1, updated_at = now() where id = $2', [status, id])
  revalidatePath('/automations')
  revalidatePath(`/automations/${id}`)
  return { success: true }
}

export async function deleteAutomation(id: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from automations where id = $1', [id])
  revalidatePath('/automations')
  return { success: true }
}

// ─── Disparadores (triggers tipados) ─────────────────────────────────────────
const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('form_submitted'), form_id: z.string().uuid() }),
  z.object({ type: z.literal('booking_created'), calendar_id: z.string().uuid().nullable() }),
  z.object({ type: z.literal('tag_added'), tag: z.string().trim().min(1, 'Escribe la etiqueta').max(60) }),
])

export async function addTrigger(
  automationId: string,
  input: { type: TriggerType; form_id?: string; calendar_id?: string | null; tag?: string }
): Promise<{ success?: boolean; error?: string }> {
  const parsed = triggerSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Disparador inválido' }
  const { type, ...config } = parsed.data
  await query(
    'insert into automation_trigger_defs (automation_id, type, config) values ($1, $2, $3)',
    [automationId, type, config]
  )
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

export async function deleteTrigger(id: string, automationId: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from automation_trigger_defs where id = $1', [id])
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

// ─── Nodos del workflow ───────────────────────────────────────────────────────
const DEFAULT_CONFIG: Record<NodeType, Record<string, unknown>> = {
  send_email: { subject: 'Asunto del email', body: 'Escribe aquí tu mensaje.' },
  wait: { delay_value: 1, delay_unit: 'days' },
  add_tag: { tag: '' },
  add_note: { note: '' },
  branch_email_click: { wait_value: 2, wait_unit: 'days' },
}

/**
 * Inserta un nodo en una cadena (raíz o rama). `afterNodeId = null` → al principio
 * de la cadena; si no, justo después de ese nodo (desplazando a los siguientes).
 */
export async function addNode(
  automationId: string,
  input: {
    type: NodeType
    parentNodeId: string | null
    branch: NodeBranch | null
    afterNodeId: string | null
  }
): Promise<{ success?: boolean; error?: string; id?: string }> {
  if (!(input.type in DEFAULT_CONFIG)) return { error: 'Tipo de paso inválido' }

  let position = 0
  if (input.afterNodeId) {
    const after = await queryOne<{ position: number }>(
      'select position from automation_nodes where id = $1',
      [input.afterNodeId]
    )
    if (!after) return { error: 'Paso de referencia no encontrado' }
    position = after.position + 1
  }

  // Hace hueco desplazando los hermanos posteriores
  await query(
    `update automation_nodes set position = position + 1
     where automation_id = $1 and parent_node_id is not distinct from $2
       and branch is not distinct from $3 and position >= $4`,
    [automationId, input.parentNodeId, input.branch, position]
  )

  const node = await queryOne<{ id: string }>(
    `insert into automation_nodes (automation_id, parent_node_id, branch, position, type, config)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [automationId, input.parentNodeId, input.branch, position, input.type, DEFAULT_CONFIG[input.type]]
  )

  revalidatePath(`/automations/${automationId}`)
  return { success: true, id: node!.id }
}

const nodeConfigSchema = z.object({
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().max(8000).optional(),
  delay_value: z.coerce.number().int().min(0).max(365).optional(),
  delay_unit: z.enum(['days', 'hours']).optional(),
  tag: z.string().trim().max(60).optional(),
  note: z.string().trim().max(2000).optional(),
  wait_value: z.coerce.number().int().min(1).max(365).optional(),
  wait_unit: z.enum(['days', 'hours']).optional(),
})

export async function updateNode(
  id: string,
  automationId: string,
  config: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  const parsed = nodeConfigSchema.safeParse(config)
  if (!parsed.success) return { error: 'Datos inválidos' }

  await query(
    `update automation_nodes set config = config || $1 where id = $2`,
    [JSON.stringify(parsed.data), id]
  )
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

export async function deleteNode(id: string, automationId: string): Promise<{ success?: boolean; error?: string }> {
  // Las subcadenas de rama caen en cascada (FK). Inscripciones apuntando aquí →
  // current_node_id queda null y el motor las completa sin error.
  await query('delete from automation_nodes where id = $1', [id])
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

// ─── Envío público del formulario ─────────────────────────────────────────────
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

  const form = await queryOne<{ id: string; name: string }>(
    'select id, name from forms where slug = $1',
    [slug]
  )
  if (!form) return { error: 'Formulario no encontrado' }

  // Dedup contacto por email (patrón createPublicBooking)
  let contactId: string | null = null
  const found = await queryOne<{ id: string }>(
    'select id from contacts where email ilike $1 limit 1',
    [email]
  )
  if (found) {
    contactId = found.id
    await query(
      'update contacts set last_activity_at = now(), phone = coalesce($1, phone) where id = $2',
      [phone || null, contactId]
    )
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const nc = await queryOne<{ id: string }>(
      `insert into contacts (first_name, last_name, email, phone, source, last_activity_at)
       values ($1, $2, $3, $4, 'form', now()) returning id`,
      [firstName, rest.join(' ') || null, email, phone || null]
    )
    contactId = nc?.id ?? null
  }

  if (contactId) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'form_submitted', $2, $3)`,
      [contactId, `Formulario: ${form.name}`, message ? { message } : {}]
    )
  }

  // Dispara los workflows con trigger "formulario enviado" (no bloquea si falla)
  if (contactId) {
    try {
      await fireTrigger('form_submitted', { formId: form.id }, contactId, email)
      await processDueEmails() // envía los emails inmediatos al instante
    } catch {
      /* el contacto ya está guardado; no romper la respuesta */
    }
  }

  revalidatePath('/contacts')
  return { success: true }
}
