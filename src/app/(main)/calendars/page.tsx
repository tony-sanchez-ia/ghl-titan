import Link from 'next/link'
import { Plus, Clock, Calendar as CalIcon } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { listCalendars, listUpcomingBookings } from '@/features/scheduling/services/calendars'
import { BookingsTable } from '@/features/scheduling/components/BookingsTable'

export default async function CalendarsPage() {
  const [calendars, bookings] = await Promise.all([
    listCalendars(),
    listUpcomingBookings(),
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
