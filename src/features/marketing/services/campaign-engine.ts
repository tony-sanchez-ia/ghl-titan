import { query, queryOne } from '@/lib/db'
import { getResend, EMAIL_FROM } from '@/lib/email/client'
import { applyMergeTags, renderEmailHtml } from './render'
import type { CampaignAudience, CampaignRecipient, Contact, EmailCampaign } from '@/types/database'

/** WHERE de la audiencia: contactos con email, no dados de baja, y (opcional) con alguna de las etiquetas. */
function audienceWhere(audience: CampaignAudience): { where: string; params: unknown[] } {
  const conditions = ['c.email is not null', "c.email <> ''", 'c.unsubscribed_at is null']
  const params: unknown[] = []
  if (audience.type === 'tags' && audience.tags && audience.tags.length > 0) {
    params.push(audience.tags)
    conditions.push(`c.tags && $${params.length}::text[]`)
  }
  return { where: conditions.join(' and '), params }
}

/** Cuántos contactos recibirían la campaña ahora mismo. */
export async function countAudience(audience: CampaignAudience): Promise<number> {
  const { where, params } = audienceWhere(audience)
  const row = await queryOne<{ n: string }>(
    `select count(*)::int as n from contacts c where ${where}`,
    params
  )
  return Number(row?.n ?? 0)
}

/**
 * Congela la audiencia de la campaña creando sus destinatarios (con token de tracking).
 * Idempotente: on conflict (campaign_id, contact_id) do nothing.
 * Devuelve cuántos destinatarios existen tras materializar.
 */
export async function materializeRecipients(
  campaignId: string,
  audience: CampaignAudience
): Promise<number> {
  const { where, params } = audienceWhere(audience)
  await query(
    `insert into campaign_recipients (campaign_id, contact_id, to_email, click_token)
     select $${params.length + 1}, c.id, c.email, encode(gen_random_bytes(16), 'hex')
     from contacts c where ${where}
     on conflict (campaign_id, contact_id) do nothing`,
    [...params, campaignId]
  )
  const row = await queryOne<{ n: number }>(
    `select count(*)::int as n from campaign_recipients where campaign_id = $1`,
    [campaignId]
  )
  return Number(row?.n ?? 0)
}

// ─── Envío ────────────────────────────────────────────────────────────────────

const BATCH = 25 // por ejecución del cron (Resend free ≈ 2 req/s y 100/día)
const PAUSE_MS = 400 // entre envíos, para respetar el rate limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
}

/**
 * Envía hasta `limit` destinatarios pendientes de una campaña.
 * Cada fila se RECLAMA atómicamente (update ... where status='pending') antes de enviar:
 * dos ejecuciones simultáneas jamás envían el mismo email dos veces.
 * Cierra la campaña (sent) cuando no quedan pendientes.
 */
export async function processCampaignBatch(
  campaignId: string,
  limit: number = BATCH
): Promise<{ sent: number; failed: number; skipped: number; pendingLeft: number }> {
  const campaign = await queryOne<EmailCampaign>(
    `select * from email_campaigns where id = $1 and status = 'sending'`,
    [campaignId]
  )
  if (!campaign) return { sent: 0, failed: 0, skipped: 0, pendingLeft: 0 }

  const resend = getResend()
  const base = siteUrl()
  let sent = 0
  let failed = 0
  let skipped = 0

  const batch = await query<CampaignRecipient>(
    `select * from campaign_recipients
     where campaign_id = $1 and status = 'pending'
     order by created_at limit $2`,
    [campaignId, limit]
  )

  for (const recipient of batch) {
    // Reclamar la fila: si otra ejecución la tomó, saltarla
    const claimed = await queryOne<{ id: string }>(
      `update campaign_recipients set status = 'sent', sent_at = now()
       where id = $1 and status = 'pending' returning id`,
      [recipient.id]
    )
    if (!claimed) continue

    const contact = await queryOne<Contact>(`select * from contacts where id = $1`, [
      recipient.contact_id,
    ])

    // Baja o sin email posterior a la materialización → omitido
    if (!contact || !contact.email || contact.unsubscribed_at) {
      await query(`update campaign_recipients set status = 'skipped', sent_at = null where id = $1`, [
        recipient.id,
      ])
      skipped++
      continue
    }

    const fail = async (msg: string) => {
      await query(
        `update campaign_recipients set status = 'failed', sent_at = null, error = $1 where id = $2`,
        [msg.slice(0, 500), recipient.id]
      )
      failed++
    }

    if (!resend) {
      await fail('RESEND_API_KEY no configurada')
      continue
    }

    const merge = {
      nombre: contact.first_name ?? '',
      apellido: contact.last_name ?? '',
      email: contact.email,
    }
    const html = renderEmailHtml({
      blocks: campaign.design,
      merge,
      unsubscribeUrl: `${base}/unsubscribe/${contact.unsubscribe_token}`,
      rewriteUrl: (url) => `${base}/r/${recipient.click_token}?u=${encodeURIComponent(url)}`,
    })
    const subject = applyMergeTags(campaign.subject, merge)

    try {
      const res = await resend.emails.send({ from: EMAIL_FROM, to: contact.email, subject, html })
      if (res.error) throw new Error(res.error.message)
      await query(
        `insert into contact_activities (contact_id, type, description, metadata)
         values ($1, 'email_sent', $2, $3)`,
        [contact.id, `Campaña: ${campaign.name}`, { campaign_id: campaign.id, recipient_id: recipient.id }]
      )
      sent++
    } catch (e) {
      await fail((e as Error).message)
    }
    await sleep(PAUSE_MS)
  }

  const left = await queryOne<{ n: number }>(
    `select count(*)::int as n from campaign_recipients where campaign_id = $1 and status = 'pending'`,
    [campaignId]
  )
  const pendingLeft = Number(left?.n ?? 0)
  if (pendingLeft === 0) {
    await query(
      `update email_campaigns set status = 'sent', completed_at = now(), updated_at = now()
       where id = $1 and status = 'sending'`,
      [campaignId]
    )
  }
  return { sent, failed, skipped, pendingLeft }
}

/**
 * Punto de entrada del cron:
 * 1) dispara campañas programadas vencidas (materializa su audiencia en ese momento),
 * 2) avanza todas las campañas en 'sending' un lote.
 */
export async function processCampaigns(): Promise<{
  fired: number
  sent: number
  failed: number
  skipped: number
}> {
  // Programadas vencidas → sending (transición atómica, sin dobles disparos)
  const due = await query<EmailCampaign>(
    `update email_campaigns
     set status = 'sending', started_at = now(), scheduled_at = null, updated_at = now()
     where status = 'scheduled' and scheduled_at <= now()
     returning *`
  )
  for (const campaign of due) {
    await materializeRecipients(campaign.id, campaign.audience)
  }

  const sending = await query<{ id: string }>(`select id from email_campaigns where status = 'sending'`)
  let sent = 0
  let failed = 0
  let skipped = 0
  for (const c of sending) {
    const res = await processCampaignBatch(c.id)
    sent += res.sent
    failed += res.failed
    skipped += res.skipped
  }
  return { fired: due.length, sent, failed, skipped }
}
