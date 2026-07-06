import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { migrateDesign } from '@/features/marketing/services/design'
import { renderEmailHtml } from '@/features/marketing/services/render'
import type { CampaignRecipient, Contact, EmailCampaign } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * "Ver este email en el navegador": versión pública y PERSONALIZADA del email
 * de un destinatario de campaña (token = click_token, no adivinable).
 * Los links siguen pasando por /r/[token] (los clicks desde el navegador también cuentan).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const recipient = await queryOne<CampaignRecipient>(
    `select * from campaign_recipients where click_token = $1`,
    [token]
  )
  if (!recipient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [campaign, contact] = await Promise.all([
    queryOne<EmailCampaign>(`select * from email_campaigns where id = $1`, [recipient.campaign_id]),
    queryOne<Contact>(`select * from contacts where id = $1`, [recipient.contact_id]),
  ])
  if (!campaign || !contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const html = renderEmailHtml({
    design: migrateDesign(campaign.design),
    merge: {
      nombre: contact.first_name ?? '',
      apellido: contact.last_name ?? '',
      email: contact.email ?? '',
    },
    unsubscribeUrl: `${base}/unsubscribe/${contact.unsubscribe_token}`,
    rewriteUrl: (url) => `${base}/r/${recipient.click_token}?u=${encodeURIComponent(url)}`,
  })

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow', // datos personales del destinatario
      'cache-control': 'no-store',
    },
  })
}
