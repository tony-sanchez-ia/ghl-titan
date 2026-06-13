'use client'

import { useState } from 'react'
import { Clock, Video, MapPin, CheckCircle2, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createPublicBooking } from '@/actions/calendars'
import type { DaySlots } from '../services/availability'
import type { Calendar } from '@/types/database'

interface Props {
  calendar: Pick<Calendar, 'slug' | 'name' | 'description' | 'duration_min' | 'location_type'>
  days: DaySlots[]
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // semana empieza en lunes

function locationLabel(type: Calendar['location_type']): string {
  if (type === 'google_meet') return 'Google Meet'
  if (type === 'custom_link') return 'Videollamada'
  return 'Presencial'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Etiqueta del mes (ej. "junio 2026") sin depender de la zona del navegador. */
function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1))
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
}

export function BookingFlow({ calendar, days }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const firstDate = days[0]?.date ?? null

  const [selectedDate, setSelectedDate] = useState<string | null>(firstDate)
  const [selectedSlot, setSelectedSlot] = useState<{ iso: string; time: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ time: string; locationType: string; locationValue: string | null } | null>(null)

  // Mes mostrado en el calendario (deriva del primer día disponible)
  const initial = firstDate ? firstDate.split('-').map(Number) : null
  const [view, setView] = useState<{ y: number; m: number }>(
    initial ? { y: initial[0], m: initial[1] - 1 } : { y: 2026, m: 0 }
  )

  const dayData = selectedDate ? byDate.get(selectedDate) : undefined
  const LocationIcon = calendar.location_type === 'in_person' ? MapPin : Video

  // Límites de navegación de mes (según días disponibles)
  const monthIndex = (ymd: string) => {
    const [y, m] = ymd.split('-').map(Number)
    return y * 12 + (m - 1)
  }
  const minMonth = firstDate ? monthIndex(firstDate) : 0
  const maxMonth = days.length ? monthIndex(days[days.length - 1].date) : 0
  const curMonth = view.y * 12 + view.m

  function shiftMonth(delta: number) {
    const next = curMonth + delta
    if (next < minMonth || next > maxMonth) return
    setView({ y: Math.floor(next / 12), m: next % 12 })
  }

  // Construye las celdas del mes mostrado
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() // 0=domingo
  const leadingBlanks = (firstDow + 6) % 7 // semana empieza en lunes
  const cells: (string | null)[] = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${view.y}-${pad(view.m + 1)}-${pad(d)}`)

  async function handleSubmit(formData: FormData) {
    if (!selectedSlot) return
    setLoading(true)
    setError(null)
    formData.set('slug', calendar.slug)
    formData.set('slotIso', selectedSlot.iso)
    const res = await createPublicBooking(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setDone({
      time: selectedSlot.time,
      locationType: res.locationType ?? calendar.location_type,
      locationValue: res.locationValue ?? null,
    })
  }

  if (done) {
    return (
      <div className={`${ui.card} max-w-lg mx-auto p-8 text-center`}>
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h2 className="text-xl font-bold mt-4">¡Cita confirmada!</h2>
        <p className="text-muted mt-2">
          Tu cita para <strong className="text-fg">{calendar.name}</strong> está reservada.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 text-sm">
          <LocationIcon size={16} className="text-muted" />
          {done.locationValue ? (
            <a href={done.locationValue} className="text-primary hover:underline" target="_blank" rel="noreferrer">
              {done.locationValue}
            </a>
          ) : (
            <span className="text-muted">{locationLabel(done.locationType as Calendar['location_type'])} — recibirás los detalles por email</span>
          )}
        </div>
      </div>
    )
  }

  if (days.length === 0) {
    return (
      <div className={`${ui.card} max-w-lg mx-auto p-8 text-center`}>
        <CalendarDays size={40} className="mx-auto text-muted" />
        <p className="mt-4 text-muted">No hay horarios disponibles ahora mismo.</p>
      </div>
    )
  }

  return (
    <div className={`${ui.card} max-w-3xl mx-auto overflow-hidden`}>
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">{calendar.name}</h1>
        {calendar.description && <p className="text-muted mt-1 text-sm whitespace-pre-line">{calendar.description}</p>}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Clock size={15} /> {calendar.duration_min} min</span>
          <span className="inline-flex items-center gap-1.5"><LocationIcon size={15} /> {locationLabel(calendar.location_type)}</span>
        </div>
      </div>

      {!selectedSlot ? (
        <div className="grid md:grid-cols-2 gap-0">
          {/* Calendario del mes */}
          <div className="p-5 border-b md:border-b-0 md:border-r border-border">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => shiftMonth(-1)}
                disabled={curMonth <= minMonth}
                className="p-1.5 rounded-lg hover:bg-bg disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium capitalize">{monthLabel(view.y, view.m)}</span>
              <button
                onClick={() => shiftMonth(1)}
                disabled={curMonth >= maxMonth}
                className="p-1.5 rounded-lg hover:bg-bg disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-xs text-muted font-medium py-1">{w}</div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={`b${i}`} />
                const available = byDate.has(date)
                const dayNum = Number(date.split('-')[2])
                const isSelected = selectedDate === date
                return (
                  <button
                    key={date}
                    onClick={() => available && setSelectedDate(date)}
                    disabled={!available}
                    className={`aspect-square rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : available
                          ? 'text-fg hover:bg-primary-soft font-medium'
                          : 'text-muted/40 cursor-default'
                    }`}
                  >
                    {dayNum}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted mt-3 text-center">Elige un día disponible (resaltado).</p>
          </div>

          {/* Horas del día seleccionado */}
          <div className="p-5 max-h-[22rem] overflow-y-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3 capitalize">
              {dayData ? dayData.label : 'Selecciona un día'}
            </p>
            {dayData ? (
              <div className="grid grid-cols-3 gap-2">
                {dayData.slots.map((s) => (
                  <button key={s.iso} onClick={() => setSelectedSlot(s)} className={`${ui.button} px-2 py-2 text-sm`}>
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Elige un día en el calendario para ver las horas.</p>
            )}
          </div>
        </div>
      ) : (
        <form action={handleSubmit} className="p-6 space-y-4 max-w-md">
          <button type="button" onClick={() => setSelectedSlot(null)} className="text-sm text-primary hover:underline">
            ← Cambiar horario
          </button>
          <div className="text-sm">
            <span className="text-muted">Horario seleccionado:</span>{' '}
            <span className="font-medium capitalize">{dayData?.label} · {selectedSlot.time}</span>
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre completo</label>
            <input id="name" name="name" required className={ui.input} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input id="email" name="email" type="email" required className={ui.input} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">Teléfono <span className="text-muted font-normal">(opcional)</span></label>
            <input id="phone" name="phone" type="tel" className={ui.input} />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">¿Algo que debamos saber? <span className="text-muted font-normal">(opcional)</span></label>
            <textarea id="notes" name="notes" rows={2} className={ui.input} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={`${ui.buttonPrimary} w-full px-4 py-2.5 disabled:opacity-50`}>
            {loading ? 'Confirmando...' : 'Confirmar cita'}
          </button>
        </form>
      )}
    </div>
  )
}
