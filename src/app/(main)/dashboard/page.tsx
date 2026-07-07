import Link from 'next/link'
import {
  Activity,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { queryOne } from '@/lib/db'
import { getBookingStats } from '@/features/scheduling/services/calendars'
import {
  getActiveAutomations,
  getRecentBookings,
  getRecentContacts,
} from '@/features/dashboard/services/queries'
import { getSystemHealth, type HealthStatus } from '@/features/dashboard/services/health'

export const dynamic = 'force-dynamic'

const HEALTH_DOT: Record<HealthStatus, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
}

const BOOKING_STATUS: Record<string, { label: string; classes: string }> = {
  confirmed: { label: 'Confirmada', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  cancelled: { label: 'Cancelada', classes: 'bg-bg text-muted' },
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function DashboardPage() {
  const [contactsRow, bookingStats, health, recentContacts, recentBookings, automations] =
    await Promise.all([
      queryOne<{ count: string }>('select count(*) as count from contacts'),
      getBookingStats(),
      getSystemHealth(),
      getRecentContacts(10),
      getRecentBookings(10),
      getActiveAutomations(),
    ])

  const stats = [
    { label: 'Contactos', value: Number(contactsRow?.count ?? 0), icon: Users, href: '/contacts' },
    { label: 'Citas próximas', value: bookingStats.upcoming, icon: Calendar, href: '/calendars' },
    { label: 'Citas este mes', value: bookingStats.thisMonth, icon: CalendarCheck, href: '/calendars' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inicio</h1>
        <p className="mt-1 text-muted">Bienvenido a GHL Titan.</p>
      </div>

      {/* Salud del sistema */}
      <div className={`${ui.card} p-4`}>
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Activity size={15} className="text-primary" /> Salud del sistema
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {health.map((h) => (
            <div key={h.key} className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs font-medium inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[h.status]}`} />
                {h.label}
              </p>
              <p className="text-xs text-muted mt-1 leading-snug">{h.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* Últimos contactos + últimas reservas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`${ui.card} divide-y divide-border`}>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <UserPlus size={15} className="text-primary" /> Últimos contactos
            </h2>
            <Link href="/contacts" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {recentContacts.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted text-center">Aún no hay contactos.</p>
          )}
          {recentContacts.map((c) => (
            <Link
              key={c.id}
              href={`/contacts/${c.id}`}
              className="px-5 py-2.5 flex items-center gap-3 hover:bg-bg transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Sin nombre'}
                </p>
                <p className="text-xs text-muted truncate">{c.email}</p>
              </div>
              {c.source && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg text-muted shrink-0">
                  {c.source}
                </span>
              )}
              <span className="text-xs text-muted shrink-0">{timeAgo(c.created_at)}</span>
            </Link>
          ))}
        </div>

        <div className={`${ui.card} divide-y divide-border`}>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <CalendarPlus size={15} className="text-primary" /> Últimas reservas
            </h2>
            <Link href="/calendars/bookings" className="text-xs text-primary hover:underline">
              Gestionar citas
            </Link>
          </div>
          {recentBookings.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted text-center">Aún no hay reservas.</p>
          )}
          {recentBookings.map((b) => {
            const st = BOOKING_STATUS[b.status] ?? { label: b.status, classes: 'bg-bg text-muted' }
            return (
              <div key={b.id} className="px-5 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted truncate">
                    {b.calendar_name} · cita el {fmtDate(b.starts_at)}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${st.classes}`}>
                  {st.label}
                </span>
                <span className="text-xs text-muted shrink-0">{timeAgo(b.created_at)}</span>
              </div>
            )
          })}
        </div>
      </div>

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
