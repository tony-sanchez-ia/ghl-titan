import Link from 'next/link'
import { Users, Calendar, CalendarCheck } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createClient } from '@/lib/supabase/server'
import { getBookingStats } from '@/features/scheduling/services/calendars'

export default async function DashboardPage() {
  const supabase = await createClient()
  const [{ count: contactsCount }, bookingStats] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    getBookingStats(),
  ])

  const stats = [
    { label: 'Contactos', value: contactsCount ?? 0, icon: Users, href: '/contacts' },
    { label: 'Citas próximas', value: bookingStats.upcoming, icon: Calendar, href: '/calendars' },
    { label: 'Citas este mes', value: bookingStats.thisMonth, icon: CalendarCheck, href: '/calendars' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">Inicio</h1>
      <p className="mt-1 text-muted">Bienvenido a GHL Titan.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className={`${ui.card} p-5 hover:border-primary transition-colors`}>
              <div className="flex items-center justify-between">
                <p className="text-muted text-sm">{s.label}</p>
                <Icon size={18} className="text-muted" />
              </div>
              <p className="text-3xl font-bold mt-3">{s.value}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
