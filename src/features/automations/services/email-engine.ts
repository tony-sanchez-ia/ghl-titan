import { getResend, EMAIL_FROM } from '@/lib/email/client'
import { query } from '@/lib/db'
import { migrateDesign } from '@/features/marketing/services/design'
import { renderEmailHtml, applyMergeTags, type MergeData } from '@/features/marketing/services/render'
import type { ScheduledEmail } from '@/types/database'

const URL_REGEX = /https?:\/\/[^\s<>"']+/g

/** Extrae las URLs del cuerpo en texto plano (para validar redirects de tracking). */
export function extractUrls(bodyText: string): string[] {
  return bodyText.match(URL_REGEX) ?? []
}

/**
 * Envoltorio HTML para los emails de automatización. Si hay `clickToken`,
 * las URLs del cuerpo se convierten en links que pasan por /r/[token] (tracking).
 */
function shell(subject: string, bodyText: string, clickToken?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const safe = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(URL_REGEX, (url) => {
      const href = clickToken && base ? `${base}/r/${clickToken}?u=${encodeURIComponent(url)}` : url
      return `<a href="${href}" style="color:#2563eb">${url}</a>`
    })
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

/**
 * Envía los scheduled_emails vencidos y pendientes. Marca sent/failed.
 * Idempotente: solo procesa status='pending' con send_at<=now.
 * Devuelve { processed, sent, failed }.
 */
type DueEmail = ScheduledEmail & {
  contact_first_name: string | null
  contact_last_name: string | null
  contact_unsubscribed_at: string | null
  contact_unsubscribe_token: string | null
}

export async function processDueEmails(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const resend = getResend()

  const due = await query<DueEmail>(
    `select s.*,
       c.first_name as contact_first_name,
       c.last_name as contact_last_name,
       c.unsubscribed_at as contact_unsubscribed_at,
       c.unsubscribe_token as contact_unsubscribe_token
     from scheduled_emails s
     left join contacts c on c.id = s.contact_id
     where s.status = 'pending' and s.send_at <= now()
     order by s.send_at limit 100`
  )

  if (due.length === 0) return { processed: 0, sent: 0, failed: 0 }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  let sent = 0
  let failed = 0

  for (const email of due) {
    if (!resend) {
      await query(
        `update scheduled_emails set status = 'failed', error = 'RESEND_API_KEY no configurada' where id = $1`,
        [email.id]
      )
      failed++
      continue
    }
    // Baja RGPD: los contactos dados de baja no reciben emails de secuencia
    if (email.contact_unsubscribed_at) {
      await query(
        `update scheduled_emails set status = 'failed', error = 'Contacto dado de baja (no se envía)' where id = $1`,
        [email.id]
      )
      failed++
      continue
    }
    try {
      const merge: MergeData = {
        nombre: email.contact_first_name ?? '',
        apellido: email.contact_last_name ?? '',
        email: email.to_email,
      }
      let html: string
      if (email.design) {
        // Modo diseñado: render V2 + tracking de clicks vía /r/[token]
        const rewriteUrl =
          email.click_token && base
            ? (u: string) => `${base}/r/${email.click_token}?u=${encodeURIComponent(u)}`
            : undefined
        html = renderEmailHtml({
          design: migrateDesign(email.design),
          merge,
          unsubscribeUrl:
            email.contact_unsubscribe_token && base
              ? `${base}/unsubscribe/${email.contact_unsubscribe_token}`
              : null,
          rewriteUrl,
        })
      } else {
        html = shell(
          applyMergeTags(email.subject, merge),
          applyMergeTags(email.body, merge),
          email.click_token
        )
      }
      const res = await resend.emails.send({
        from: EMAIL_FROM,
        to: email.to_email,
        subject: applyMergeTags(email.subject, merge),
        html,
      })
      if (res.error) throw new Error(res.error.message)
      await query(
        `update scheduled_emails set status = 'sent', sent_at = now(), error = null where id = $1`,
        [email.id]
      )
      await query(
        `insert into contact_activities (contact_id, type, description, metadata)
         values ($1, 'email_sent', $2, $3)`,
        [email.contact_id, `Email de secuencia: ${email.subject}`, { scheduled_email_id: email.id }]
      )
      sent++
    } catch (e) {
      await query(
        `update scheduled_emails set status = 'failed', error = $1 where id = $2`,
        [(e as Error).message.slice(0, 500), email.id]
      )
      failed++
    }
  }

  return { processed: due.length, sent, failed }
}
