import { query } from '@/lib/db'

export interface RecentContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  source: string | null
  created_at: string
}

/** Últimos contactos que han entrado (más recientes primero). */
export async function getRecentContacts(limit = 10): Promise<RecentContact[]> {
  return query<RecentContact>(
    `select id, first_name, last_name, email, source, created_at
     from contacts order by created_at desc limit $1`,
    [limit]
  )
}

export interface RecentBooking {
  id: string
  name: string
  starts_at: string
  status: string
  calendar_name: string
  contact_id: string | null
  created_at: string
}

/** Últimas reservas que han entrado (por fecha de creación, no de cita). */
export async function getRecentBookings(limit = 10): Promise<RecentBooking[]> {
  return query<RecentBooking>(
    `select b.id, b.name, b.starts_at, b.status, b.contact_id, b.created_at,
            c.name as calendar_name
     from bookings b
     join calendars c on c.id = b.calendar_id
     order by b.created_at desc limit $1`,
    [limit]
  )
}

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
