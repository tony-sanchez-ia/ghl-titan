'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { CalendarClock, X } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { cancelBooking, getRescheduleSlots, rescheduleBooking } from '@/actions/calendars'
import type { DaySlots } from '../services/availability'
import type { BookingWithCalendar, BookingFilter } from '../services/calendars'

const TZ = 'Europe/Madrid'

export function BookingsTable({
  bookings,
  filter,
}: {
  bookings: BookingWithCalendar[]
  filter: BookingFilter
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reschedule, setReschedule] = useState<BookingWithCalendar | null>(null)

  async function onCancel(id: string) {
    if (!confirm('¿Cancelar esta cita? El horario quedará libre de nuevo.')) return
    setBusyId(id)
    const res = await cancelBooking(id)
    setBusyId(null)
    if (res?.error) { alert(res.error); return }
    router.refresh()
  }

  if (bookings.length === 0) {
    return <div className={`${ui.card} p-8 text-center text-muted`}>No hay citas.</div>
  }

  return (
    <>
      <div className={`${ui.card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Cuándo</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Calendario</th>
              {filter === 'upcoming' && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 capitalize whitespace-nowrap">
                  {formatInTimeZone(new Date(b.starts_at), TZ, 'EEE d MMM, HH:mm', { locale: es })}
                </td>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-muted hidden md:table-cell">{b.email}</td>
                <td className="px-4 py-3 text-muted hidden lg:table-cell">{b.calendar?.name ?? '—'}</td>
                {filter === 'upcoming' && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setReschedule(b)} disabled={busyId === b.id} className={`${ui.button} px-2.5 py-1.5 text-xs`}>
                        <CalendarClock size={14} /> Reprogramar
                      </button>
                      <button onClick={() => onCancel(b.id)} disabled={busyId === b.id} className={`${ui.button} px-2.5 py-1.5 text-xs text-red-600`}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reschedule && (
        <RescheduleModal
          booking={reschedule}
          onClose={() => setReschedule(null)}
          onDone={() => { setReschedule(null); router.refresh() }}
        />
      )}
    </>
  )
}

function RescheduleModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithCalendar
  onClose: () => void
  onDone: () => void
}) {
  const [days, setDays] = useState<DaySlots[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Carga los huecos al montar
  useEffect(() => {
    getRescheduleSlots(booking.id).then((res) => {
      if (res?.error) setError(res.error)
      else {
        setDays(res.days ?? [])
        setSelectedDate(res.days?.[0]?.date ?? null)
      }
    })
  }, [booking.id])

  async function pick(iso: string) {
    setSaving(true)
    setError(null)
    const res = await rescheduleBooking(booking.id, iso)
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    onDone()
  }

  const dayData = days?.find((d) => d.date === selectedDate)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${ui.card} w-full max-w-xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Reprogramar cita de {booking.name}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-fg"><X size={20} /></button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {days === null && !error && <p className="text-muted text-sm">Cargando huecos...</p>}
        {days && days.length === 0 && <p className="text-muted text-sm">No hay huecos disponibles.</p>}

        {days && days.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="max-h-72 overflow-y-auto space-y-1">
              {days.map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize ${selectedDate === d.date ? 'bg-primary-soft text-primary font-medium' : 'hover:bg-bg'}`}
                >
                  {d.label} <span className="text-muted">({d.slots.length})</span>
                </button>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto grid grid-cols-2 gap-2 content-start">
              {dayData?.slots.map((s) => (
                <button key={s.iso} onClick={() => pick(s.iso)} disabled={saving} className={`${ui.button} px-2 py-2 text-sm disabled:opacity-50`}>
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
