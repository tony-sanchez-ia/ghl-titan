import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import type { Calendar, CalendarAvailability, Booking } from '@/types/database'

export interface Slot {
  iso: string // inicio en UTC (ISO)
  time: string // 'HH:MM' en la zona del calendario
}

export interface DaySlots {
  date: string // 'yyyy-MM-dd' en la zona del calendario
  label: string // ej. 'lun 16 jun'
  slots: Slot[]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Suma n días a una fecha 'yyyy-MM-dd' usando un ancla UTC (estable). */
function addDays(ymd: string, n: number): { ymd: string; weekday: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  const out = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  return { ymd: out, weekday: dt.getUTCDay() }
}

/**
 * Genera los huecos disponibles de un calendario.
 * Pura: recibe el calendario, sus franjas, las citas confirmadas y "ahora".
 * Respeta zona horaria (con cambio CET/CEST), aviso mínimo, ventana y buffers.
 */
export function generateSlots(
  calendar: Calendar,
  availability: CalendarAvailability[],
  bookings: Pick<Booking, 'starts_at' | 'ends_at'>[],
  now: Date = new Date()
): DaySlots[] {
  const tz = calendar.timezone || 'Europe/Madrid'
  const earliest = now.getTime() + calendar.min_notice_hours * 3600_000

  // Citas confirmadas expandidas con buffers (en epoch ms).
  const blocked = bookings.map((b) => ({
    start: new Date(b.starts_at).getTime() - calendar.buffer_before_min * 60_000,
    end: new Date(b.ends_at).getTime() + calendar.buffer_after_min * 60_000,
  }))

  const todayYmd = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const days: DaySlots[] = []

  for (let i = 0; i <= calendar.window_days; i++) {
    const { ymd, weekday } = addDays(todayYmd, i)
    const rules = availability.filter((a) => a.weekday === weekday)
    if (rules.length === 0) continue

    const slots: Slot[] = []
    for (const rule of rules) {
      const startMin = timeToMinutes(rule.start_time)
      const endMin = timeToMinutes(rule.end_time)
      for (
        let m = startMin;
        m + calendar.duration_min <= endMin;
        m += calendar.duration_min
      ) {
        const hhmm = minutesToHHMM(m)
        const startUtc = fromZonedTime(`${ymd}T${hhmm}:00`, tz)
        const startMs = startUtc.getTime()
        const endMs = startMs + calendar.duration_min * 60_000

        if (startMs < earliest) continue

        const conflicts = blocked.some(
          (b) => startMs < b.end && endMs > b.start
        )
        if (conflicts) continue

        slots.push({ iso: startUtc.toISOString(), time: hhmm })
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.time.localeCompare(b.time))
      days.push({
        date: ymd,
        label: formatInTimeZone(
          fromZonedTime(`${ymd}T12:00:00`, tz),
          tz,
          'EEE d MMM',
          { locale: es }
        ),
        slots,
      })
    }
  }

  return days
}
