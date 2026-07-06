import { query, queryOne } from '@/lib/db'
import type { Calendar, CalendarAvailability, Booking } from '@/types/database'

export interface CalendarWithAvailability extends Calendar {
  availability: CalendarAvailability[]
}

/** [admin] Lista los calendarios con el conteo de citas próximas. */
export async function listCalendars(): Promise<Calendar[]> {
  return query<Calendar>('select * from calendars order by created_at desc')
}

/** [admin] Calendario con sus franjas de disponibilidad. */
export async function getCalendarById(
  id: string
): Promise<CalendarWithAvailability | null> {
  const calendar = await queryOne<Calendar>('select * from calendars where id = $1', [id])
  if (!calendar) return null

  const availability = await query<CalendarAvailability>(
    'select * from calendar_availability where calendar_id = $1 order by weekday, start_time',
    [id]
  )

  return { ...calendar, availability }
}

/** [público] Calendario activo por slug + disponibilidad + citas futuras confirmadas. */
export async function getPublicCalendarBySlug(slug: string): Promise<{
  calendar: Calendar
  availability: CalendarAvailability[]
  bookings: Pick<Booking, 'starts_at' | 'ends_at'>[]
} | null> {
  const calendar = await queryOne<Calendar>(
    'select * from calendars where slug = $1 and is_active',
    [slug]
  )
  if (!calendar) return null

  const [availability, bookings] = await Promise.all([
    query<CalendarAvailability>(
      'select * from calendar_availability where calendar_id = $1',
      [calendar.id]
    ),
    query<Pick<Booking, 'starts_at' | 'ends_at'>>(
      `select starts_at, ends_at from bookings
       where calendar_id = $1 and status = 'confirmed' and starts_at >= now()`,
      [calendar.id]
    ),
  ])

  return { calendar, availability, bookings }
}

export interface BookingWithCalendar extends Booking {
  calendar: Pick<Calendar, 'name' | 'slug'> | null
}

type BookingRow = Booking & { calendar_name: string | null; calendar_slug: string | null }

function toBookingWithCalendar(row: BookingRow): BookingWithCalendar {
  const { calendar_name, calendar_slug, ...booking } = row
  return {
    ...booking,
    calendar: calendar_name ? { name: calendar_name, slug: calendar_slug ?? '' } : null,
  }
}

const BOOKING_SELECT = `select b.*, c.name as calendar_name, c.slug as calendar_slug
  from bookings b left join calendars c on c.id = b.calendar_id`

/** [admin] Próximas citas confirmadas. */
export async function listUpcomingBookings(
  limit = 50
): Promise<BookingWithCalendar[]> {
  const rows = await query<BookingRow>(
    `${BOOKING_SELECT}
     where b.status = 'confirmed' and b.starts_at >= now()
     order by b.starts_at asc limit $1`,
    [limit]
  )
  return rows.map(toBookingWithCalendar)
}

/** [admin] Conteos para los tiles del dashboard. */
export async function getBookingStats(): Promise<{
  upcoming: number
  thisMonth: number
}> {
  const row = await queryOne<{ upcoming: string; this_month: string }>(
    `select
       count(*) filter (where starts_at >= now()) as upcoming,
       count(*) filter (where starts_at >= date_trunc('month', now())
                          and starts_at < date_trunc('month', now()) + interval '1 month') as this_month
     from bookings where status = 'confirmed'`
  )
  return { upcoming: Number(row?.upcoming ?? 0), thisMonth: Number(row?.this_month ?? 0) }
}

export type BookingFilter = 'upcoming' | 'past' | 'cancelled'

/** [admin] Lista citas según filtro, con su calendario. */
export async function listBookings(
  filter: BookingFilter = 'upcoming'
): Promise<BookingWithCalendar[]> {
  let where: string
  let order: string
  if (filter === 'upcoming') {
    where = `b.status = 'confirmed' and b.starts_at >= now()`
    order = 'asc'
  } else if (filter === 'past') {
    where = `b.status = 'confirmed' and b.starts_at < now()`
    order = 'desc'
  } else {
    where = `b.status = 'cancelled'`
    order = 'desc'
  }

  const rows = await query<BookingRow>(
    `${BOOKING_SELECT} where ${where} order by b.starts_at ${order} limit 100`
  )
  return rows.map(toBookingWithCalendar)
}
