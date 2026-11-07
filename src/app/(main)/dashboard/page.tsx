import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { CalendarPlus, Zap } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import {
  DASHBOARD_TZ,
  getActiveAutomations,
  getCampaignsInMonth,
  getContactsSummary,
  getRecentCampaigns,
  getUpcomingBookings,
  type UpcomingBooking,
} from '@/features/dashboard/services/queries'
import { getInstanceSettings } from '@/features/instance/services/instance-settings'
import { CampaignCalendar } from '@/features/dashboard/components/CampaignCalendar'
import { SuggestionCards } from '@/features/dashboard/components/SuggestionCards'
import { RecentCampaigns } from '@/features/dashboard/components/RecentCampaigns'
import { ContactsSummaryCard } from '@/features/dashboard/components/ContactsSummaryCard'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DASHBOARD_TZ,
  })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>
}) {
  const params = await searchParams
  const today = formatInTimeZone(new Date(), DASHBOARD_TZ, 'yyyy-MM-dd')
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? params.day! : today
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : day.slice(0, 7)

  const session = await getSession()
  const { modules } = await getInstanceSettings()
  const [user, monthCampaigns, recentCampaigns, contacts, bookings, automations] = await Promise.all([
    session
      ? queryOne<{ full_name: string | null }>('select full_name from users where id = $1', [session.sub])
      : Promise.resolve(null),
    getCampaignsInMonth(month),
    getRecentCampaigns(5),
    getContactsSummary(),
    modules.calendars ? getUpcomingBookings(5) : Promise.resolve<UpcomingBooking[]>([]),
    getActiveAutomations(),
  ])
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || session?.email.split('@')[0] || ''

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hola{firstName ? `, ${firstName}` : ''}</h1>

      <CampaignCalendar month={month} day={day} today={today} campaigns={monthCampaigns} />

      <SuggestionCards formsEnabled={modules.forms} />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">
        <RecentCampaigns campaigns={recentCampaigns} />
        <ContactsSummaryCard summary={contacts} />
      </div>

      {modules.calendars && (
        <div className={`${ui.card} divide-y divide-border`}>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <CalendarPlus size={15} className="text-primary" /> Próximas citas
            </h2>
            <Link href="/calendars/bookings" className="text-xs text-primary hover:underline">
              Gestionar citas
            </Link>
          </div>
          {bookings.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted text-center">No hay citas próximas.</p>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="px-5 py-2.5 flex items-center gap-3">
              <p className="flex-1 text-sm font-medium truncate">{b.name}</p>
              <span className="text-xs text-muted shrink-0">
                {b.calendar_name} · {fmtDate(b.starts_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Automatizaciones en curso */}
      <div className={`${ui.card} divide-y divide-border`}>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Zap size={15} className="text-primary" /> Automatizaciones en curso
          </h2>
          <Link href="/automations" className="text-xs text-primary hover:underline">
            Ver automatizaciones
          </Link>
        </div>
        {automations.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted text-center">
            No hay automatizaciones activas ahora mismo.
          </p>
        )}
        {automations.map((a) => (
          <Link
            key={a.id}
            href={`/automations/${a.id}`}
            className="px-5 py-2.5 flex items-center gap-3 hover:bg-bg transition-colors"
          >
            <p className="flex-1 text-sm font-medium truncate">{a.name}</p>
            <span className="text-xs text-muted shrink-0">
              {a.in_progress === 0
                ? 'sin contactos en curso'
                : `${a.in_progress} ${a.in_progress === 1 ? 'contacto' : 'contactos'} en curso`}
            </span>
            {a.next_run_at && (
              <span className="text-xs text-muted shrink-0">
                · siguiente paso {fmtDate(a.next_run_at)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
