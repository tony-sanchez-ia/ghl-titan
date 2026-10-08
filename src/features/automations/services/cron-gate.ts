import { lastQueryAt, queryOne } from '@/lib/db'

/**
 * Evita que el cron despierte la BD (Neon escala a cero tras 5 min sin uso)
 * cuando sabemos que no hay trabajo: solo se procesa si hubo actividad en la
 * BD desde la última revisión, si vence algo ya conocido, o como red de
 * seguridad cada SAFETY_MS (cambios hechos por otro proceso, p. ej. en local).
 */
const SAFETY_MS = 6 * 60 * 60 * 1000

declare global {
  // eslint-disable-next-line no-var
  var __cronGate: { checkedAt: number; nextDueAt: number } | undefined
}

export function shouldProcess(now = Date.now()): boolean {
  const gate = global.__cronGate
  if (!gate) return true // proceso recién arrancado: estado desconocido
  return lastQueryAt() > gate.checkedAt || now >= gate.nextDueAt || now - gate.checkedAt >= SAFETY_MS
}

/** Calcula cuándo vence el próximo trabajo pendiente y lo memoriza. */
export async function rememberNextDue(): Promise<void> {
  const row = await queryOne<{ next_due: Date | null }>(
    `select least(
       (select min(send_at) from scheduled_emails where status = 'pending'),
       (select min(e.next_run_at) from automation_enrollments e
        join automations a on a.id = e.automation_id and a.status = 'active'
        where e.status = 'active'),
       (select min(e.wait_until) from automation_enrollments e
        join automations a on a.id = e.automation_id and a.status = 'active'
        where e.status = 'waiting_click'),
       (select min(scheduled_at) from email_campaigns where status = 'scheduled'),
       (select now() from email_campaigns where status = 'sending' limit 1)
     ) as next_due`
  )
  global.__cronGate = {
    checkedAt: lastQueryAt(), // inicio de esta query: lo posterior cuenta como actividad nueva
    nextDueAt: row?.next_due ? new Date(row.next_due).getTime() : Infinity,
  }
}
