import { queryOne } from '@/lib/db'

export type HealthStatus = 'ok' | 'warn' | 'error'

export interface HealthCheck {
  key: string
  label: string
  status: HealthStatus
  detail: string
}

/** Latencia de un `select 1` contra Neon. */
async function checkDatabase(): Promise<HealthCheck> {
  const started = Date.now()
  try {
    await queryOne('select 1 as ok')
    const ms = Date.now() - started
    return {
      key: 'db',
      label: 'Base de datos (Neon)',
      status: ms < 1500 ? 'ok' : 'warn',
      detail: `Conectada · ${ms} ms`,
    }
  } catch (err) {
    return {
      key: 'db',
      label: 'Base de datos (Neon)',
      status: 'error',
      detail: `Sin conexión: ${(err as Error).message.slice(0, 80)}`,
    }
  }
}

/** Clave de OpenRouter presente y válida (ping real a su API con timeout corto). */
async function checkOpenRouter(): Promise<HealthCheck> {
  const base = { key: 'ai', label: 'IA (OpenRouter)' }
  if (!process.env.OPENROUTER_API_KEY) {
    return { ...base, status: 'warn', detail: 'Sin configurar (falta OPENROUTER_API_KEY)' }
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    })
    if (res.ok) return { ...base, status: 'ok', detail: 'Clave válida · conexión OK' }
    if (res.status === 401) return { ...base, status: 'error', detail: 'La clave no es válida' }
    return { ...base, status: 'warn', detail: `OpenRouter respondió ${res.status}` }
  } catch {
    return { ...base, status: 'warn', detail: 'Clave presente, pero no se pudo conectar' }
  }
}

/** Resend configurado (envío de emails). */
function checkResend(): HealthCheck {
  const base = { key: 'email', label: 'Emails (Resend)' }
  if (!process.env.RESEND_API_KEY)
    return { ...base, status: 'warn', detail: 'Sin configurar (falta RESEND_API_KEY)' }
  const from = process.env.EMAIL_FROM ?? ''
  if (from.includes('@resend.dev'))
    return { ...base, status: 'warn', detail: 'Solo envíos de prueba (dominio Resend sin verificar)' }
  return { ...base, status: 'ok', detail: `Configurado · envía como ${from || '(sin EMAIL_FROM)'}` }
}

/** El cron está al día si no hay trabajo vencido esperando >15 minutos. */
async function checkCron(): Promise<HealthCheck> {
  const base = { key: 'cron', label: 'Cron de automatizaciones' }
  if (!process.env.CRON_SECRET)
    return { ...base, status: 'warn', detail: 'Sin configurar (falta CRON_SECRET)' }
  try {
    const row = await queryOne<{ emails: number; enrollments: number }>(
      `select
         (select count(*)::int from scheduled_emails
          where status = 'pending' and send_at < now() - interval '15 minutes') as emails,
         (select count(*)::int from automation_enrollments
          where status = 'active' and next_run_at < now() - interval '15 minutes') as enrollments`
    )
    const overdue = (row?.emails ?? 0) + (row?.enrollments ?? 0)
    if (overdue > 0)
      return {
        ...base,
        status: 'warn',
        detail: `${overdue} tareas atrasadas: revisa que el cron esté llamando a /api/cron/process-emails`,
      }
    return { ...base, status: 'ok', detail: 'Sin trabajo atrasado' }
  } catch {
    return { ...base, status: 'warn', detail: 'No se pudo comprobar' }
  }
}

/** Sesiones firmadas (AUTH_SECRET). */
function checkAuth(): HealthCheck {
  return process.env.AUTH_SECRET
    ? { key: 'auth', label: 'Autenticación', status: 'ok', detail: 'Sesiones firmadas correctamente' }
    : { key: 'auth', label: 'Autenticación', status: 'error', detail: 'Falta AUTH_SECRET' }
}

/** Salud del sistema: todos los chequeos en paralelo (nunca lanza). */
export async function getSystemHealth(): Promise<HealthCheck[]> {
  const [db, ai, cron] = await Promise.all([checkDatabase(), checkOpenRouter(), checkCron()])
  return [db, checkAuth(), checkResend(), ai, cron]
}
