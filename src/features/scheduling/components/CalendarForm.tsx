'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/shared/lib/ui'
import { createCalendar, updateCalendar } from '@/actions/calendars'
import type { Calendar } from '@/types/database'

export function CalendarForm({ calendar }: { calendar?: Calendar }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [locationType, setLocationType] = useState(calendar?.location_type ?? 'google_meet')
  const isEdit = !!calendar

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = isEdit
      ? await updateCalendar(calendar!.id, formData)
      : await createCalendar(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    if (isEdit) router.refresh()
    else if ('id' in res && res.id) router.push(`/calendars/${res.id}`)
  }

  const num = (label: string, name: keyof Calendar, def: number, hint?: string) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>
      <input
        id={name}
        name={name}
        type="number"
        defaultValue={(calendar?.[name] as number | undefined) ?? def}
        className={ui.input}
      />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  )

  return (
    <form action={handleSubmit} className="space-y-5 max-w-2xl">
      <div className={`${ui.card} p-5 space-y-4`}>
        <h2 className="font-semibold">Detalles</h2>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre</label>
          <input id="name" name="name" defaultValue={calendar?.name ?? ''} required className={ui.input} placeholder="Llamada de descubrimiento" />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-1">
            Enlace público <span className="text-muted font-normal">(se genera del nombre si lo dejas vacío)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">/book/</span>
            <input id="slug" name="slug" defaultValue={calendar?.slug ?? ''} className={ui.input} placeholder="descubrimiento" />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Descripción</label>
          <textarea id="description" name="description" defaultValue={calendar?.description ?? ''} rows={3} className={ui.input} />
        </div>
      </div>

      <div className={`${ui.card} p-5 space-y-4`}>
        <h2 className="font-semibold">Reglas de reserva</h2>
        <div className="grid grid-cols-2 gap-4">
          {num('Duración (min)', 'duration_min', 30)}
          {num('Ventana de fechas (días)', 'window_days', 14, 'Hasta cuántos días vista se puede reservar')}
          {num('Aviso mínimo (horas)', 'min_notice_hours', 12, 'Antelación mínima para reservar')}
          <div />
          {num('Margen antes (min)', 'buffer_before_min', 0)}
          {num('Margen después (min)', 'buffer_after_min', 0)}
        </div>
      </div>

      <div className={`${ui.card} p-5 space-y-4`}>
        <h2 className="font-semibold">Ubicación de la reunión</h2>
        <div>
          <label htmlFor="location_type" className="block text-sm font-medium mb-1">Tipo</label>
          <select
            id="location_type"
            name="location_type"
            defaultValue={calendar?.location_type ?? 'google_meet'}
            onChange={(e) => setLocationType(e.target.value as Calendar['location_type'])}
            className={ui.input}
          >
            <option value="google_meet">Google Meet</option>
            <option value="custom_link">Enlace propio (Zoom, Meet fijo...)</option>
            <option value="in_person">Presencial</option>
          </select>
          {locationType === 'google_meet' && (
            <p className="text-xs text-muted mt-1">
              La generación automática de un Meet por cita se activará al conectar Google.
              Mientras tanto puedes poner un enlace fijo en el campo de abajo.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="location_value" className="block text-sm font-medium mb-1">
            {locationType === 'in_person' ? 'Dirección' : 'Enlace de la reunión'}
          </label>
          <input id="location_value" name="location_value" defaultValue={calendar?.location_value ?? ''} className={ui.input} placeholder={locationType === 'in_person' ? 'Calle, ciudad...' : 'https://meet.google.com/...'} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className={`${ui.button} px-4 py-2.5`}>Cancelar</button>
        <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear calendario'}
        </button>
      </div>
    </form>
  )
}
