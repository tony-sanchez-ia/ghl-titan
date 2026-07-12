import Link from 'next/link'
import { Plus, Clock, Calendar as CalIcon } from 'lucide-react'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { ui } from '@/shared/lib/ui'
import { listCalendars, listUpcomingBookings } from '@/features/scheduling/services/calendars'
import { BookingsTable } from '@/features/scheduling/components/BookingsTable'
import { OutlookWeekView } from '@/features/scheduling/components/OutlookWeekView'
import { getOutlookConnection } from '@/features/integrations/services/outlook-auth'
import { getOutlookWeekEvents } from '@/features/integrations/services/outlook-events'

const TZ = 'Europe/Madrid'

/** Lunes ('yyyy-MM-dd') de la semana mostrada: ?week=YYYY-MM-DD o la actual. */
function resolveWeekStart(weekParam: string | undefined, todayYmd: string): string {
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) return weekParam
  const [y, m, d] = todayYmd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)) // retrocede hasta el lunes
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const todayYmd = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
  const weekStartYmd = resolveWeekStart(week, todayYmd)

  // Rango lunes 00:00 → domingo 00:00 (cubre lunes-sábado completos, hora local)
  const from = fromZonedTime(`${weekStartYmd}T00:00:00`, TZ)
  const [wy, wm, wd] = weekStartYmd.split('-').map(Number)
  const sunday = new Date(Date.UTC(wy, wm - 1, wd + 6))
  const to = fromZonedTime(
    `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}T00:00:00`,
    TZ
  )

  const [calendars, bookings, outlook, outlookEvents] = await Promise.all([
    listCalendars(),
    listUpcomingBookings(),
    getOutlookConnection(),
    getOutlookWeekEvents(from, to),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="mt-1 text-muted">Calendarios y citas.</p>
        </div>
        <Link href="/calendars/new" className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
          <Plus size={16} /> Nuevo calendario
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Calendarios</h2>
        {calendars.length === 0 ? (
          <div className={`${ui.card} p-10 text-center`}>
            <CalIcon size={36} className="mx-auto text-muted" />
            <p className="mt-3 text-muted">Aún no tienes calendarios.</p>
            <Link href="/calendars/new" className={`${ui.buttonPrimary} px-4 py-2.5 text-sm mt-4`}>
              Crear el primero
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calendars.map((c) => (
              <Link key={c.id} href={`/calendars/${c.id}`} className={`${ui.card} p-5 hover:border-primary transition-colors`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
                    {c.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-muted mt-1">/book/{c.slug}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted mt-3">
                  <Clock size={14} /> {c.duration_min} min
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <OutlookWeekView
        weekStartYmd={weekStartYmd}
        todayYmd={todayYmd}
        events={outlookEvents}
        calendarName={outlook?.calendar_name ?? null}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Próximas citas</h2>
          <Link href="/calendars/bookings" className="text-sm text-primary hover:underline">
            Gestionar citas →
          </Link>
        </div>
        <BookingsTable bookings={bookings} filter="upcoming" />
      </section>
    </div>
  )
}
