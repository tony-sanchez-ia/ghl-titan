import type { SupabaseClient } from '@supabase/supabase-js'
import { getResend, EMAIL_FROM } from '@/lib/email/client'
import { createAdminClient } from '@/lib/supabase/admin'

/** Envoltorio HTML para los emails de automatización. */
function shell(subject: string, bodyText: string): string {
  const safe = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
        <h2 style="margin:0 0 12px;font-size:18px">${subject}</h2>
        <div style="font-size:15px;line-height:1.6">${safe}</div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Enviado por GHL Titan</p>
    </div>
  </body></html>`
}

/** ms equivalentes a un delay (days|hours). */
function delayMs(value: number, unit: string): number {
  const factor = unit === 'hours' ? 3600_000 : 86_400_000
  return value * factor
}

type Admin = SupabaseClient

/**
 * Inscribe un contacto en una automatización ACTIVA: crea una scheduled_email
 * por paso con send_at = ahora + delay acumulado. No envía aquí (lo hace processDueEmails).
 */
export async function enrollContactInAutomation(
  admin: Admin,
  automationId: string,
  contactId: string,
  toEmail: string
): Promise<number> {
  const { data: automation } = await admin
    .from('automations')
    .select('id, status')
    .eq('id', automationId)
    .eq('status', 'active')
    .maybeSingle()
  if (!automation) return 0

  const { data: steps } = await admin
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .order('position')
  if (!steps || steps.length === 0) return 0

  let cumulative = 0
  const now = Date.now()
  const rows = steps.map((s) => {
    cumulative += delayMs(s.delay_value, s.delay_unit)
    return {
      automation_id: automationId,
      step_id: s.id,
      contact_id: contactId,
      to_email: toEmail,
      subject: s.subject,
      body: s.body,
      send_at: new Date(now + cumulative).toISOString(),
    }
  })

  const { error } = await admin.from('scheduled_emails').insert(rows)
  if (error) return 0
  return rows.length
}

/**
 * Envía los scheduled_emails vencidos y pendientes. Marca sent/failed.
 * Idempotente: solo procesa status='pending' con send_at<=now.
 * Devuelve { processed, sent, failed }.
 */
export async function processDueEmails(
  client?: Admin
): Promise<{ processed: number; sent: number; failed: number }> {
  const admin = client ?? createAdminClient()
  const resend = getResend()

  const { data: due } = await admin
    .from('scheduled_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('send_at', new Date().toISOString())
    .order('send_at')
    .limit(100)

  if (!due || due.length === 0) return { processed: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const email of due) {
    if (!resend) {
      await admin
        .from('scheduled_emails')
        .update({ status: 'failed', error: 'RESEND_API_KEY no configurada' })
        .eq('id', email.id)
      failed++
      continue
    }
    try {
      const res = await resend.emails.send({
        from: EMAIL_FROM,
        to: email.to_email,
        subject: email.subject,
        html: shell(email.subject, email.body),
      })
      if (res.error) throw new Error(res.error.message)
      await admin
        .from('scheduled_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', email.id)
      await admin.from('contact_activities').insert({
        contact_id: email.contact_id,
        type: 'email_sent',
        description: `Email de secuencia: ${email.subject}`,
        metadata: { scheduled_email_id: email.id },
      })
      sent++
    } catch (e) {
      await admin
        .from('scheduled_emails')
        .update({ status: 'failed', error: (e as Error).message.slice(0, 500) })
        .eq('id', email.id)
      failed++
    }
  }

  return { processed: due.length, sent, failed }
}
