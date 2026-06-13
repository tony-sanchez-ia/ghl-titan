import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { listBookings, type BookingFilter } from '@/features/scheduling/services/calendars'
import { BookingsTable } from '@/features/scheduling/components/BookingsTable'

const TABS: { key: BookingFilter; label: string }[] = [
  { key: 'upcoming', label: 'Próximas' },
  { key: 'past', label: 'Pasadas' },
  { key: 'cancelled', label: 'Canceladas' },
]

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter: raw } = await searchParams
  const filter: BookingFilter =
    raw === 'past' || raw === 'cancelled' ? raw : 'upcoming'
  const bookings = await listBookings(filter)

  return (
    <div className="space-y-6">
      <Link href="/calendars" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Agenda
      </Link>
      <h1 className="text-2xl font-bold">Citas</h1>

      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/calendars/bookings?filter=${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key ? 'bg-primary-soft text-primary' : 'text-muted hover:text-fg hover:bg-bg'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <BookingsTable bookings={bookings} filter={filter} />
    </div>
  )
}
