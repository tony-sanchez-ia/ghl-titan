import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { extractUrls } from '@/features/automations/services/email-engine'
import { resolveBranch } from '@/features/automations/services/engine'
import type { AutomationEnrollment, CampaignRecipient, ScheduledEmail } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Tracking de clicks: /r/[token]?u=<destino>
 * Reconoce tokens de automatizaciones (scheduled_emails) y de campañas
 * (campaign_recipients). Registra el click y redirige al destino.
 * Anti open-redirect: el destino DEBE ser una de las URLs reales del email
 * (cuerpo o link_urls del snapshot); si no, se usa la primera.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const email = await queryOne<ScheduledEmail>(
    'select * from scheduled_emails where click_token = $1',
    [token]
  )
  if (!email) {
    return handleCampaignClick(request, token)
  }

  // Destino validado contra las URLs reales del cuerpo (nunca redirect arbitrario)
  const allowed = extractUrls(email.body)
  const requested = new URL(request.url).searchParams.get('u')
  const destination = (requested && allowed.includes(requested) ? requested : allowed[0]) ?? null

  // Registra el click solo la primera vez
  const first = await queryOne<{ id: string }>(
    'update scheduled_emails set clicked_at = now() where id = $1 and clicked_at is null returning id',
    [email.id]
  )
  if (first) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'email_clicked', $2, $3)`,
      [email.contact_id, `Click en email: ${email.subject}`, { scheduled_email_id: email.id }]
    )
  }

  // Si una inscripción esperaba el click de ESTE email → rama Sí
  const waiting = await queryOne<AutomationEnrollment>(
    `select * from automation_enrollments
     where status = 'waiting_click' and waiting_email_id = $1`,
    [email.id]
  )
  if (waiting) {
    try {
      await resolveBranch(waiting, 'yes')
    } catch {
      /* el click ya quedó registrado; el cron reintentará el avance */
    }
  }

  if (!destination) {
    // Email sin links (no debería pasar): manda a la home
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.redirect(destination, { status: 302 })
}

/** Click de campaña de marketing: marca al destinatario y redirige (validado contra link_urls). */
async function handleCampaignClick(request: Request, token: string) {
  const recipient = await queryOne<CampaignRecipient & { link_urls: string[]; campaign_name: string }>(
    `select r.*, c.link_urls, c.name as campaign_name
     from campaign_recipients r
     join email_campaigns c on c.id = r.campaign_id
     where r.click_token = $1`,
    [token]
  )
  if (!recipient) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowed = recipient.link_urls ?? []
  const requested = new URL(request.url).searchParams.get('u')
  const destination = (requested && allowed.includes(requested) ? requested : allowed[0]) ?? null

  const first = await queryOne<{ id: string }>(
    'update campaign_recipients set clicked_at = now() where id = $1 and clicked_at is null returning id',
    [recipient.id]
  )
  if (first) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'email_clicked', $2, $3)`,
      [
        recipient.contact_id,
        `Click en campaña: ${recipient.campaign_name}`,
        { campaign_id: recipient.campaign_id, recipient_id: recipient.id },
      ]
    )
  }

  if (!destination) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.redirect(destination, { status: 302 })
}
