import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { CreateCampaignButton } from '@/features/marketing/components/CreateCampaignButton'
import type { CalendarCampaign } from '../services/queries'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const STATUS: Record<CalendarCampaign['status'], { label: string; classes: string }> = {
  scheduled: { label: 'Programada', classes: 'bg-primary-soft text-primary' },
  sending: { label: 'Enviando', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  sent: { label: 'Enviada', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Suma meses a 'YYYY-MM' sin pasar por Date (evita sorpresas de zona horaria). */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** Celdas del mes empezando en lunes, con días de relleno del mes anterior/siguiente. */
function monthGrid(month: string): { date: string; day: number; inMonth: boolean }[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7 // lunes = 0
  const start = Date.UTC(y, m - 1, 1 - offset)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start + i * 86_400_000)
    cells.push({
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
    })
  }
  // sin la última semana si es entera de relleno
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells
}

function campaignHref(c: CalendarCampaign): string {
  return c.status === 'scheduled' ? `/marketing/campaigns/${c.id}` : `/marketing?tab=stats&campaign=${c.id}`
}

/**
 * Calendario de envíos + panel del día. Navegación por ?month=YYYY-MM&day=YYYY-MM-DD
 * (RSC pura, sin estado de cliente).
 */
export function CampaignCalendar({
  month,
  day,
  today,
  campaigns,
}: {
  month: string
  day: string
  today: string
  campaigns: CalendarCampaign[]
}) {
  const daysWithCampaigns = new Set(campaigns.map((c) => c.local_at.slice(0, 10)))
  const ofDay = campaigns.filter((c) => c.local_at.startsWith(day))
  const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' })
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${month.slice(0, 4)}`
  const dayLabel =
    day === today
      ? 'hoy'
      : `el ${new Date(`${day}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`

  return (
    <div className={`${ui.card} grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr] overflow-hidden`}>
      {/* Mes */}
      <div className="p-5 border-b md:border-b-0 md:border-r border-border">
        <div className="flex items-center justify-between mb-3">
          <Link href={`/dashboard?month=${shiftMonth(month, -1)}&day=${day}`} aria-label="Mes anterior" className="p-1 rounded text-primary hover:bg-bg">
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-semibold">{monthLabel}</p>
          <Link href={`/dashboard?month=${shiftMonth(month, 1)}&day=${day}`} aria-label="Mes siguiente" className="p-1 rounded text-primary hover:bg-bg">
            <ChevronRight size={18} />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-xs text-muted py-1">{w}</span>
          ))}
          {monthGrid(month).map((c) => {
            const selected = c.date === day
            return (
              <Link
                key={c.date}
                href={`/dashboard?month=${month}&day=${c.date}`}
                className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                  selected
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : c.date === today
                      ? 'border border-primary text-primary'
                      : c.inMonth
                        ? 'hover:bg-bg'
                        : 'text-muted/60 hover:bg-bg'
                }`}
              >
                {c.day}
                {daysWithCampaigns.has(c.date) && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-primary'}`}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Día */}
      <div className="p-5 bg-bg flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Programado para {dayLabel}</h2>
          <CreateCampaignButton />
        </div>
        {ofDay.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">Nada programado para {dayLabel}</p>
        ) : (
          <div className="space-y-2">
            {ofDay.map((c) => (
              <Link
                key={c.id}
                href={campaignHref(c)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary transition-colors"
              >
                <CalendarClock size={16} className="text-primary shrink-0" />
                <span className="text-sm text-muted shrink-0">{c.local_at.slice(11)}</span>
                <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${STATUS[c.status].classes}`}>
                  {STATUS[c.status].label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
