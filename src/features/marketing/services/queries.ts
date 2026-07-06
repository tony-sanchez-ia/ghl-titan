import { query, queryOne } from '@/lib/db'
import type { EmailCampaign, EmailTemplate } from '@/types/database'

export interface CampaignListItem {
  id: string
  name: string
  subject: string
  status: EmailCampaign['status']
  scheduled_at: string | null
  started_at: string | null
  updated_at: string
  recipients: number
  sent: number
  failed: number
  skipped: number
  pending: number
  clicks: number
}

export async function listCampaigns(): Promise<CampaignListItem[]> {
  return query<CampaignListItem>(
    `select c.id, c.name, c.subject, c.status, c.scheduled_at, c.started_at, c.updated_at,
            count(r.id)::int as recipients,
            count(r.id) filter (where r.status = 'sent')::int as sent,
            count(r.id) filter (where r.status = 'failed')::int as failed,
            count(r.id) filter (where r.status = 'skipped')::int as skipped,
            count(r.id) filter (where r.status = 'pending')::int as pending,
            count(r.id) filter (where r.clicked_at is not null)::int as clicks
     from email_campaigns c
     left join campaign_recipients r on r.campaign_id = c.id
     group by c.id
     order by c.updated_at desc`
  )
}

export interface RecipientRow {
  id: string
  contact_id: string
  to_email: string
  status: string
  sent_at: string | null
  clicked_at: string | null
  error: string | null
  first_name: string | null
  last_name: string | null
}

/** Destinatarios de una campaña con el nombre del contacto (para el detalle de estadísticas). */
export async function listCampaignRecipients(campaignId: string): Promise<RecipientRow[]> {
  return query<RecipientRow>(
    `select r.id, r.contact_id, r.to_email, r.status, r.sent_at, r.clicked_at, r.error,
            c.first_name, c.last_name
     from campaign_recipients r
     left join contacts c on c.id = r.contact_id
     where r.campaign_id = $1
     order by r.clicked_at desc nulls last, r.created_at`,
    [campaignId]
  )
}

export async function getCampaign(id: string): Promise<EmailCampaign | null> {
  return queryOne<EmailCampaign>(`select * from email_campaigns where id = $1`, [id])
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  return query<EmailTemplate>(`select * from email_templates order by updated_at desc`)
}
