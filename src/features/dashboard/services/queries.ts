import { query } from '@/lib/db'

export interface ActiveAutomation {
  id: string
  name: string
  in_progress: number
  next_run_at: string | null
}

/** Automatizaciones activas con contactos en curso (inscripciones vivas). */
export async function getActiveAutomations(): Promise<ActiveAutomation[]> {
  return query<ActiveAutomation>(
    `select a.id, a.name,
            count(e.id) filter (where e.status in ('active', 'waiting_click'))::int as in_progress,
            min(e.next_run_at) filter (where e.status = 'active') as next_run_at
     from automations a
     left join automation_enrollments e on e.automation_id = a.id
     where a.status = 'active'
     group by a.id
     order by in_progress desc, a.name`
  )
}

// ── Inicio estilo newsletter (PRP-019) ──────────────────────────────────────

/** Zona horaria del negocio: los días del calendario se cuentan en Madrid, no en UTC. */
export const DASHBOARD_TZ = 'Europe/Madrid'

export interface CalendarCampaign {
  id: string
  name: string
  status: 'scheduled' | 'sending' | 'sent'
  /** Fecha/hora local (Madrid) 'YYYY-MM-DD HH24:MI' */
  local_at: string
}

/**
 * Campañas de un mes (YYYY-MM): programadas por scheduled_at y las ya arrancadas por
 * started_at (al arrancar, scheduled_at se pone a null).
 */
export async function getCampaignsInMonth(month: string): Promise<CalendarCampaign[]> {
  return query<CalendarCampaign>(
    `select id, name, status, to_char(at_local, 'YYYY-MM-DD HH24:MI') as local_at
     from (
       select id, name, status,
              (case when status = 'scheduled' then scheduled_at else started_at end) at time zone $2 as at_local
       from email_campaigns
       where status in ('scheduled', 'sending', 'sent')
     ) c
     where to_char(at_local, 'YYYY-MM') = $1
     order by at_local`,
    [month, DASHBOARD_TZ]
  )
}

export interface RecentCampaign {
  id: string
  name: string
  status: 'sending' | 'sent'
  started_at: string
  opens_tracked: boolean
  sent: number
  opens: number
  clicks: number
}

/** Últimas campañas enviadas (o enviándose) con sus métricas. */
export async function getRecentCampaigns(limit = 5): Promise<RecentCampaign[]> {
  return query<RecentCampaign>(
    `select c.id, c.name, c.status, c.started_at, c.opens_tracked,
            count(r.id) filter (where r.status = 'sent')::int as sent,
            count(r.id) filter (where r.opened_at is not null)::int as opens,
            count(r.id) filter (where r.clicked_at is not null)::int as clicks
     from email_campaigns c
     left join campaign_recipients r on r.campaign_id = c.id
     where c.status in ('sending', 'sent') and c.started_at is not null
     group by c.id
     order by c.started_at desc
     limit $1`,
    [limit]
  )
}

export interface ContactsSummary {
  total: number
  new_30d: number
  unsubscribed: number
}

export async function getContactsSummary(): Promise<ContactsSummary> {
  const rows = await query<ContactsSummary>(
    `select count(*)::int as total,
            count(*) filter (where created_at >= now() - interval '30 days')::int as new_30d,
            count(*) filter (where unsubscribed_at is not null)::int as unsubscribed
     from contacts`
  )
  return rows[0] ?? { total: 0, new_30d: 0, unsubscribed: 0 }
}

export interface UpcomingBooking {
  id: string
  name: string
  starts_at: string
  calendar_name: string
}

/** Próximas citas confirmadas (solo se muestran con el módulo Agenda activo). */
export async function getUpcomingBookings(limit = 5): Promise<UpcomingBooking[]> {
  return query<UpcomingBooking>(
    `select b.id, b.name, b.starts_at, c.name as calendar_name
     from bookings b
     join calendars c on c.id = b.calendar_id
     where b.status = 'confirmed' and b.starts_at >= now()
     order by b.starts_at
     limit $1`,
    [limit]
  )
}
