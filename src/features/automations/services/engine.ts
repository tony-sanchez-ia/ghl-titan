import { randomBytes } from 'crypto'
import { query, queryOne } from '@/lib/db'
import type {
  AutomationEnrollment,
  AutomationNode,
  NodeBranch,
  TriggerType,
} from '@/types/database'

/**
 * Motor de workflows (PRP-006): cada contacto inscrito (enrollment) avanza
 * nodo a nodo con un puntero (current_node_id) y una agenda (next_run_at).
 * Los emails se depositan en scheduled_emails y los envía processDueEmails.
 */

const BATCH = 100
const MAX_NODES_PER_PASS = 20 // corta cadenas de nodos inmediatos desbocadas

function delayMs(value: number, unit: string): number {
  return value * (unit === 'hours' ? 3600_000 : 86_400_000)
}

// ─── Disparadores ─────────────────────────────────────────────────────────────

export interface TriggerMatch {
  formId?: string
  calendarId?: string
  tag?: string
}

/**
 * Dispara un evento: inscribe al contacto en todas las automatizaciones ACTIVAS
 * que tengan un trigger de ese tipo cuya config encaje, y ejecuta el primer tramo.
 */
export async function fireTrigger(
  type: TriggerType,
  match: TriggerMatch,
  contactId: string,
  email: string | null
): Promise<number> {
  const defs = await query<{ automation_id: string; config: Record<string, unknown> }>(
    `select d.automation_id, d.config
     from automation_trigger_defs d
     join automations a on a.id = d.automation_id and a.status = 'active'
     where d.type = $1`,
    [type]
  )

  const matching = new Set<string>()
  for (const d of defs) {
    const c = d.config
    if (type === 'form_submitted' && c.form_id === match.formId) matching.add(d.automation_id)
    if (type === 'booking_created' && (!c.calendar_id || c.calendar_id === match.calendarId))
      matching.add(d.automation_id)
    if (
      type === 'tag_added' &&
      typeof c.tag === 'string' &&
      c.tag.toLowerCase() === match.tag?.toLowerCase()
    )
      matching.add(d.automation_id)
  }

  let enrolled = 0
  for (const automationId of matching) {
    const e = await enroll(automationId, contactId, email, type)
    if (e) {
      enrolled++
      await runEnrollment(e)
    }
  }
  return enrolled
}

/**
 * Inscribe al contacto (dedup: una sola inscripción viva por automatización).
 * Devuelve la inscripción nueva o null si ya estaba inscrito / no hay pasos.
 */
export async function enroll(
  automationId: string,
  contactId: string,
  email: string | null,
  triggerType?: TriggerType
): Promise<AutomationEnrollment | null> {
  const first = await queryOne<{ id: string }>(
    `select id from automation_nodes
     where automation_id = $1 and parent_node_id is null
     order by position limit 1`,
    [automationId]
  )
  if (!first) return null // sin pasos: nada que recorrer

  const enrollment = await queryOne<AutomationEnrollment>(
    `insert into automation_enrollments (automation_id, contact_id, status, current_node_id, next_run_at, context)
     values ($1, $2, 'active', $3, now(), $4)
     on conflict (automation_id, contact_id) where status in ('active','waiting_click') do nothing
     returning *`,
    [automationId, contactId, first.id, { email, trigger_type: triggerType }]
  )
  if (!enrollment) return null // ya tenía una inscripción viva

  await query(
    `insert into contact_activities (contact_id, type, description, metadata)
     values ($1, 'enrolled', 'Inscrito en secuencia de emails', $2)`,
    [contactId, { automation_id: automationId, enrollment_id: enrollment.id }]
  )
  return enrollment
}

// ─── Procesador ───────────────────────────────────────────────────────────────

/**
 * Procesa inscripciones: ramas con ventana vencida (→ rama No) y nodos vencidos.
 * Idempotente; lo llama el cron y los triggers inline.
 */
export async function processEnrollments(): Promise<{ processed: number }> {
  let processed = 0

  // 1) Ventanas de click vencidas → rama No
  const expired = await query<AutomationEnrollment>(
    `select e.* from automation_enrollments e
     join automations a on a.id = e.automation_id and a.status = 'active'
     where e.status = 'waiting_click' and e.wait_until <= now()
     order by e.wait_until limit $1`,
    [BATCH]
  )
  for (const e of expired) {
    await resolveBranch(e, 'no')
    processed++
  }

  // 2) Nodos con next_run_at vencido
  const due = await query<AutomationEnrollment>(
    `select e.* from automation_enrollments e
     join automations a on a.id = e.automation_id and a.status = 'active'
     where e.status = 'active' and e.next_run_at <= now()
     order by e.next_run_at limit $1`,
    [BATCH]
  )
  for (const e of due) {
    await runEnrollment(e)
    processed++
  }

  return { processed }
}

/**
 * Resuelve la rama de una inscripción en espera de click: la manda por la
 * subcadena Sí/No (o la completa si la rama está vacía) y ejecuta el tramo inmediato.
 */
export async function resolveBranch(
  enrollment: AutomationEnrollment,
  branch: NodeBranch
): Promise<void> {
  if (!enrollment.current_node_id) {
    await complete(enrollment.id)
    return
  }
  const child = await queryOne<AutomationNode>(
    `select * from automation_nodes
     where parent_node_id = $1 and branch = $2
     order by position limit 1`,
    [enrollment.current_node_id, branch]
  )
  if (!child) {
    await complete(enrollment.id)
    return
  }
  const updated = await queryOne<AutomationEnrollment>(
    `update automation_enrollments
     set status = 'active', current_node_id = $1, next_run_at = now(),
         wait_until = null, waiting_email_id = null, updated_at = now()
     where id = $2 returning *`,
    [child.id, enrollment.id]
  )
  if (updated) await runEnrollment(updated)
}

/** Ejecuta el tramo inmediato de una inscripción hasta topar con espera/rama/fin. */
export async function runEnrollment(enrollment: AutomationEnrollment): Promise<void> {
  let current = enrollment

  for (let i = 0; i < MAX_NODES_PER_PASS; i++) {
    if (!current.current_node_id) {
      await complete(current.id)
      return
    }
    const node = await queryOne<AutomationNode>(
      'select * from automation_nodes where id = $1',
      [current.current_node_id]
    )
    if (!node) {
      // Puntero huérfano (nodo borrado con inscripciones vivas): terminar sin error
      await complete(current.id)
      return
    }

    switch (node.type) {
      case 'send_email': {
        await executeSendEmail(node, current)
        current = await advance(current, node, null)
        break
      }
      case 'wait': {
        const ms = delayMs(node.config.delay_value ?? 0, node.config.delay_unit ?? 'days')
        current = await advance(current, node, new Date(Date.now() + ms))
        return // el siguiente nodo se ejecuta cuando venza next_run_at
      }
      case 'add_tag': {
        await executeAddTag(node, current)
        current = await advance(current, node, null)
        break
      }
      case 'add_note': {
        await query(
          `insert into contact_activities (contact_id, type, description, metadata)
           values ($1, 'note', $2, $3)`,
          [current.contact_id, node.config.note || 'Nota de automatización', { node_id: node.id }]
        )
        current = await advance(current, node, null)
        break
      }
      case 'branch_email_click': {
        const handled = await executeBranch(node, current)
        if (handled === 'waiting') return
        // 'yes-immediate' y 'no-email' se resuelven dentro (con su propio run)
        return
      }
      default: {
        // Tipo desconocido: saltar al siguiente para no bloquear la inscripción
        current = await advance(current, node, null)
      }
    }
    if (current.status !== 'active') return
  }
}

// ─── Ejecutores por tipo de nodo ─────────────────────────────────────────────

async function executeSendEmail(node: AutomationNode, e: AutomationEnrollment) {
  const email = e.context?.email
  if (!email) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'note', 'Email omitido: el contacto no tiene dirección', $2)`,
      [e.contact_id, { node_id: node.id }]
    )
    return
  }
  const token = randomBytes(16).toString('hex')
  await query(
    `insert into scheduled_emails
       (automation_id, node_id, enrollment_id, contact_id, to_email, subject, body, send_at, click_token)
     values ($1, $2, $3, $4, $5, $6, $7, now(), $8)`,
    [
      node.automation_id,
      node.id,
      e.id,
      e.contact_id,
      email,
      node.config.subject || '(sin asunto)',
      node.config.body || '',
      token,
    ]
  )
}

async function executeAddTag(node: AutomationNode, e: AutomationEnrollment) {
  const tag = (node.config.tag || '').trim()
  if (!tag) return
  // Nota: añadir etiqueta desde un workflow NO dispara triggers 'tag_added' (anti-bucle)
  const updated = await queryOne<{ id: string }>(
    `update contacts set tags = array_append(tags, $1), updated_at = now()
     where id = $2 and not (tags @> array[$1]) returning id`,
    [tag, e.contact_id]
  )
  if (updated) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'tag_added', $2, $3)`,
      [e.contact_id, `Etiqueta añadida: ${tag}`, { node_id: node.id }]
    )
  }
}

/**
 * Nodo rama: si el último email ya fue clickeado → rama Sí inmediata.
 * Si no → deja la inscripción esperando (wait_until). Sin email trackeable → rama No.
 */
async function executeBranch(
  node: AutomationNode,
  e: AutomationEnrollment
): Promise<'waiting' | 'resolved'> {
  const lastEmail = await queryOne<{ id: string; clicked_at: string | null }>(
    `select id, clicked_at from scheduled_emails
     where enrollment_id = $1 and click_token is not null
     order by created_at desc limit 1`,
    [e.id]
  )

  if (!lastEmail) {
    await resolveBranch(e, 'no')
    return 'resolved'
  }
  if (lastEmail.clicked_at) {
    await resolveBranch(e, 'yes')
    return 'resolved'
  }

  const ms = delayMs(node.config.wait_value ?? 2, node.config.wait_unit ?? 'days')
  await query(
    `update automation_enrollments
     set status = 'waiting_click', wait_until = $1, waiting_email_id = $2,
         next_run_at = null, updated_at = now()
     where id = $3`,
    [new Date(Date.now() + ms).toISOString(), lastEmail.id, e.id]
  )
  return 'waiting'
}

// ─── Navegación del árbol ────────────────────────────────────────────────────

/** Mueve el puntero al siguiente hermano; si no hay, completa (sin merge en V1). */
async function advance(
  e: AutomationEnrollment,
  node: AutomationNode,
  nextRunAt: Date | null
): Promise<AutomationEnrollment> {
  const next = await queryOne<AutomationNode>(
    `select * from automation_nodes
     where automation_id = $1
       and parent_node_id is not distinct from $2
       and branch is not distinct from $3
       and position > $4
     order by position limit 1`,
    [node.automation_id, node.parent_node_id, node.branch, node.position]
  )

  if (!next) {
    await complete(e.id)
    return { ...e, status: 'completed', current_node_id: null }
  }

  const runAt = (nextRunAt ?? new Date()).toISOString()
  const updated = await queryOne<AutomationEnrollment>(
    `update automation_enrollments
     set current_node_id = $1, next_run_at = $2, updated_at = now()
     where id = $3 returning *`,
    [next.id, runAt, e.id]
  )
  return updated ?? { ...e, current_node_id: next.id, next_run_at: runAt }
}

async function complete(enrollmentId: string) {
  await query(
    `update automation_enrollments
     set status = 'completed', next_run_at = null, wait_until = null, updated_at = now()
     where id = $1`,
    [enrollmentId]
  )
}
