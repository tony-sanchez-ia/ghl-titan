'use client'

import { useState } from 'react'
import { Clock, Video, MapPin, CheckCircle2, CalendarDays } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createPublicBooking } from '@/actions/calendars'
import type { DaySlots } from '../services/availability'
import type { Calendar } from '@/types/database'

interface Props {
  calendar: Pick<Calendar, 'slug' | 'name' | 'description' | 'duration_min' | 'location_type'>
  days: DaySlots[]
}

function locationLabel(type: Calendar['location_type']): string {
  if (type === 'google_meet') return 'Google Meet'
  if (type === 'custom_link') return 'Videollamada'
  return 'Presencial'
}

export function BookingFlow({ calendar, days }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(days[0]?.date ?? null)
  const [selectedSlot, setSelectedSlot] = useState<{ iso: string; time: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ time: string; locationType: string; locationValue: string | null } | null>(null)

  const dayData = days.find((d) => d.date === selectedDate)
  const LocationIcon = calendar.location_type === 'in_person' ? MapPin : Video

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
          {/* Días */}
          <div className="p-4 border-b md:border-b-0 md:border-r border-border max-h-96 overflow-y-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2 px-2">Elige día</p>
            <div className="space-y-1">
              {days.map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                    selectedDate === d.date ? 'bg-primary-soft text-primary font-medium' : 'hover:bg-bg'
                  }`}
                >
                  {d.label} <span className="text-muted">({d.slots.length})</span>
                </button>
              ))}
            </div>
          </div>
          {/* Horas */}
          <div className="p-4 max-h-96 overflow-y-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2 px-2 capitalize">{dayData?.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {dayData?.slots.map((s) => (
                <button
                  key={s.iso}
                  onClick={() => setSelectedSlot(s)}
                  className={`${ui.button} px-2 py-2 text-sm`}
                >
                  {s.time}
                </button>
              ))}
            </div>
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
