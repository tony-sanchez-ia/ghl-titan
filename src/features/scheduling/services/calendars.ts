import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Calendar, CalendarAvailability, Booking } from '@/types/database'

export interface CalendarWithAvailability extends Calendar {
  availability: CalendarAvailability[]
}

/** [admin] Lista los calendarios con el conteo de citas próximas. */
export async function listCalendars(): Promise<Calendar[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calendars')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** [admin] Calendario con sus franjas de disponibilidad. */
export async function getCalendarById(
  id: string
): Promise<CalendarWithAvailability | null> {
  const supabase = await createClient()
  const { data: calendar, error } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !calendar) return null

  const { data: availability } = await supabase
    .from('calendar_availability')
    .select('*')
    .eq('calendar_id', id)
    .order('weekday')
    .order('start_time')

  return { ...calendar, availability: availability ?? [] }
}

/** [público] Calendario activo por slug + disponibilidad + citas futuras confirmadas. */
export async function getPublicCalendarBySlug(slug: string): Promise<{
  calendar: Calendar
  availability: CalendarAvailability[]
  bookings: Pick<Booking, 'starts_at' | 'ends_at'>[]
} | null> {
  const admin = createAdminClient()
  const { data: calendar } = await admin
    .from('calendars')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (!calendar) return null

  const { data: availability } = await admin
    .from('calendar_availability')
    .select('*')
    .eq('calendar_id', calendar.id)

  const { data: bookings } = await admin
    .from('bookings')
    .select('starts_at, ends_at')
    .eq('calendar_id', calendar.id)
    .eq('status', 'confirmed')
    .gte('starts_at', new Date().toISOString())

  return {
    calendar: calendar as Calendar,
    availability: (availability ?? []) as CalendarAvailability[],
    bookings: (bookings ?? []) as Pick<Booking, 'starts_at' | 'ends_at'>[],
  }
}

export interface BookingWithCalendar extends Booking {
  calendar: Pick<Calendar, 'name' | 'slug'> | null
}

/** [admin] Próximas citas confirmadas. */
export async function listUpcomingBookings(
  limit = 50
): Promise<BookingWithCalendar[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*, calendar:calendars(name, slug)')
    .eq('status', 'confirmed')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as BookingWithCalendar[]
}

/** [admin] Conteos para los tiles del dashboard. */
export async function getBookingStats(): Promise<{
  upcoming: number
  thisMonth: number
}> {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).toISOString()

  const [{ count: upcoming }, { count: thisMonth }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('starts_at', now.toISOString()),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('starts_at', startOfMonth)
      .lt('starts_at', startOfNextMonth),
  ])

  return { upcoming: upcoming ?? 0, thisMonth: thisMonth ?? 0 }
}

export type BookingFilter = 'upcoming' | 'past' | 'cancelled'

/** [admin] Lista citas según filtro, con su calendario. */
export async function listBookings(
  filter: BookingFilter = 'upcoming'
): Promise<BookingWithCalendar[]> {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  let query = supabase.from('bookings').select('*, calendar:calendars(name, slug)')

  if (filter === 'upcoming') {
    query = query.eq('status', 'confirmed').gte('starts_at', nowIso).order('starts_at', { ascending: true })
  } else if (filter === 'past') {
    query = query.eq('status', 'confirmed').lt('starts_at', nowIso).order('starts_at', { ascending: false })
  } else {
    query = query.eq('status', 'cancelled').order('starts_at', { ascending: false })
  }

  const { data, error } = await query.limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as BookingWithCalendar[]
}
