import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { ui } from '@/shared/lib/ui'
import type { OutlookEvent } from '@/features/integrations/services/outlook-events'

/**
 * Vista semanal (lunes a sábado) del calendario de Outlook conectado, dentro
 * de Agenda. Solo lectura: para ver de un vistazo cómo queda la semana.
 * RSC pura; la navegación de semana son links (?week=YYYY-MM-DD, un lunes).
 */

const TZ = 'Europe/Madrid'
const DAYS = 6 // lunes..sábado
const HOUR_PX = 44

/** Suma días a un 'yyyy-MM-dd' con ancla UTC (estable, mismo patrón que availability). */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

const SHOW_AS_STYLE: Record<string, string> = {
  busy: 'bg-blue-600/15 border-blue-600 text-blue-800 dark:text-blue-200',
  tentative: 'bg-amber-500/15 border-amber-500 border-dashed text-amber-800 dark:text-amber-200',
  oof: 'bg-purple-600/15 border-purple-600 text-purple-800 dark:text-purple-200',
  workingElsewhere: 'bg-teal-600/10 border-teal-600 border-dashed text-teal-800 dark:text-teal-200',
  free: 'bg-transparent border-slate-400 border-dashed text-slate-600 dark:text-slate-300',
}

interface PositionedEvent {
  event: OutlookEvent
  topMin: number // minutos desde el inicio del día
  endMin: number
}

export function OutlookWeekView({
  weekStartYmd,
  todayYmd,
  events,
  calendarName,
}: {
  weekStartYmd: string // lunes de la semana mostrada
  todayYmd: string
  events: OutlookEvent[] | null // null = Outlook sin conectar
  calendarName: string | null
}) {
  // ── Sin conexión: invitación discreta ───────────────────────────────────────
  if (events === null) {
    return (
      <section className="space-y-3">
        <h2 className="font-semibold">Mi calendario (Outlook)</h2>
        <div className={`${ui.card} p-6 text-center text-sm text-muted`}>
          <CalendarRange size={24} className="mx-auto mb-2 opacity-60" />
          Conecta tu calendario de Outlook en{' '}
          <Link href="/settings" className="text-primary hover:underline">
            Ajustes → Integraciones
          </Link>{' '}
          para verlo aquí.
        </div>
      </section>
    )
  }

  const dayYmds = Array.from({ length: DAYS }, (_, i) => addDays(weekStartYmd, i))

  // Reparte los eventos por día (recortando los que cruzan medianoche)
  const timed: PositionedEvent[][] = dayYmds.map(() => [])
  const allDay: OutlookEvent[][] = dayYmds.map(() => [])

  for (const ev of events) {
    const startMs = new Date(ev.startsAt).getTime()
    const endMs = new Date(ev.endsAt).getTime()
    dayYmds.forEach((ymd, i) => {
      const dayStart = fromZonedTime(`${ymd}T00:00:00`, TZ).getTime()
      const dayEnd = fromZonedTime(`${addDays(ymd, 1)}T00:00:00`, TZ).getTime()
      if (startMs >= dayEnd || endMs <= dayStart) return
      if (ev.isAllDay) {
        allDay[i].push(ev)
        return
      }
      timed[i].push({
        event: ev,
        topMin: Math.max(0, Math.round((startMs - dayStart) / 60_000)),
        endMin: Math.min(1440, Math.round((endMs - dayStart) / 60_000)),
      })
    })
  }

  // Rango horario visible: 8–21 y se amplía si hay eventos fuera
  let hourStart = 8
  let hourEnd = 21
  for (const day of timed) {
    for (const p of day) {
      hourStart = Math.min(hourStart, Math.floor(p.topMin / 60))
      hourEnd = Math.max(hourEnd, Math.ceil(p.endMin / 60))
    }
  }
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i)
  const gridHeight = hours.length * HOUR_PX
  const hasAllDayRow = allDay.some((d) => d.length > 0)

  const prevWeek = addDays(weekStartYmd, -7)
  const nextWeek = addDays(weekStartYmd, 7)
  const weekLabel = `${formatInTimeZone(fromZonedTime(`${weekStartYmd}T12:00:00`, TZ), TZ, 'd MMM', { locale: es })} – ${formatInTimeZone(fromZonedTime(`${dayYmds[DAYS - 1]}T12:00:00`, TZ), TZ, 'd MMM yyyy', { locale: es })}`

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Mi calendario (Outlook)
          {calendarName && <span className="ml-2 text-sm font-normal text-muted">· {calendarName}</span>}
        </h2>
        <div className="flex items-center gap-1">
          <Link href={`/calendars?week=${prevWeek}`} className={`${ui.button} px-2 py-1.5`} aria-label="Semana anterior">
            <ChevronLeft size={15} />
          </Link>
          <Link href="/calendars" className={`${ui.button} px-3 py-1.5 text-xs`}>
            Hoy
          </Link>
          <Link href={`/calendars?week=${nextWeek}`} className={`${ui.button} px-2 py-1.5`} aria-label="Semana siguiente">
            <ChevronRight size={15} />
          </Link>
          <span className="ml-2 text-sm text-muted">{weekLabel}</span>
        </div>
      </div>

      <div className={`${ui.card} overflow-x-auto`}>
        <div className="min-w-[640px]">
          {/* Cabecera de días */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `3rem repeat(${DAYS}, 1fr)` }}>
            <div />
            {dayYmds.map((ymd) => (
              <div
                key={ymd}
                className={`px-2 py-2 text-center text-sm font-medium capitalize border-l border-border ${
                  ymd === todayYmd ? 'text-primary' : ''
                }`}
              >
                {formatInTimeZone(fromZonedTime(`${ymd}T12:00:00`, TZ), TZ, 'EEE d', { locale: es })}
              </div>
            ))}
          </div>

          {/* Fila de eventos de día completo */}
          {hasAllDayRow && (
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `3rem repeat(${DAYS}, 1fr)` }}>
              <div className="py-1 pr-1 text-right text-[10px] text-muted">día</div>
              {allDay.map((evs, i) => (
                <div key={dayYmds[i]} className="border-l border-border p-1 space-y-1">
                  {evs.map((ev, j) => (
                    <div
                      key={j}
                      className={`truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] ${SHOW_AS_STYLE[ev.showAs] ?? SHOW_AS_STYLE.busy}`}
                      title={ev.subject}
                    >
                      {ev.subject}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Rejilla horaria */}
          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${DAYS}, 1fr)` }}>
            {/* Eje de horas */}
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-muted"
                  style={{ top: i * HOUR_PX }}
                >
                  {i > 0 && `${String(h).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            {dayYmds.map((ymd, i) => (
              <div
                key={ymd}
                className={`relative border-l border-border ${ymd === todayYmd ? 'bg-primary-soft/40' : ''}`}
                style={{ height: gridHeight }}
              >
                {/* Líneas de hora */}
                {hours.map((h, j) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: j * HOUR_PX }} />
                ))}

                {/* Eventos */}
                {timed[i]
                  .filter((p) => p.endMin > hourStart * 60 && p.topMin < hourEnd * 60)
                  .map((p, j) => {
                    const top = ((Math.max(p.topMin, hourStart * 60) - hourStart * 60) / 60) * HOUR_PX
                    const height = Math.max(
                      18,
                      ((Math.min(p.endMin, hourEnd * 60) - Math.max(p.topMin, hourStart * 60)) / 60) * HOUR_PX
                    )
                    const timeLabel = `${formatInTimeZone(p.event.startsAt, TZ, 'HH:mm')}–${formatInTimeZone(p.event.endsAt, TZ, 'HH:mm')}`
                    return (
                      <div
                        key={j}
                        className={`absolute inset-x-0.5 overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-[11px] leading-tight ${SHOW_AS_STYLE[p.event.showAs] ?? SHOW_AS_STYLE.busy}`}
                        style={{ top, height }}
                        title={`${p.event.subject} · ${timeLabel}`}
                      >
                        <span className="font-medium block truncate">{p.event.subject}</span>
                        {height >= 34 && <span className="opacity-75">{timeLabel}</span>}
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
