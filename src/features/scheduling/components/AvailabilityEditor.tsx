'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { setAvailability } from '@/actions/calendars'
import type { CalendarAvailability } from '@/types/database'

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface Rule {
  weekday: number
  start_time: string
  end_time: string
}

function toHHMM(t: string): string {
  return t.slice(0, 5)
}

export function AvailabilityEditor({
  calendarId,
  initial,
}: {
  calendarId: string
  initial: CalendarAvailability[]
}) {
  const [rules, setRules] = useState<Rule[]>(
    initial.map((a) => ({
      weekday: a.weekday,
      start_time: toHHMM(a.start_time),
      end_time: toHHMM(a.end_time),
    }))
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addRule(weekday: number) {
    setRules((r) => [...r, { weekday, start_time: '10:00', end_time: '18:00' }])
  }
  function removeRule(index: number) {
    setRules((r) => r.filter((_, i) => i !== index))
  }
  function updateRule(index: number, patch: Partial<Rule>) {
    setRules((r) => r.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setMsg(null)
    const res = await setAvailability(calendarId, rules)
    setSaving(false)
    if (res?.error) setError(res.error)
    else setMsg('Disponibilidad guardada')
  }

  return (
    <div className={`${ui.card} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Disponibilidad semanal</h2>
        <button onClick={save} disabled={saving} className={`${ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}>
          {saving ? 'Guardando...' : 'Guardar disponibilidad'}
        </button>
      </div>

      <div className="space-y-3">
        {WEEKDAYS.map((label, weekday) => {
          const dayRules = rules
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.weekday === weekday)
          return (
            <div key={weekday} className="flex items-start gap-4 py-2 border-b border-border last:border-0">
              <div className="w-28 shrink-0 text-sm font-medium pt-2">{label}</div>
              <div className="flex-1 space-y-2">
                {dayRules.length === 0 && (
                  <p className="text-sm text-muted pt-2">No disponible</p>
                )}
                {dayRules.map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={r.start_time}
                      onChange={(e) => updateRule(i, { start_time: e.target.value })}
                      className={`${ui.input} w-auto`}
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      value={r.end_time}
                      onChange={(e) => updateRule(i, { end_time: e.target.value })}
                      className={`${ui.input} w-auto`}
                    />
                    <button onClick={() => removeRule(i)} className="text-muted hover:text-red-600 p-1" aria-label="Quitar franja">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addRule(weekday)} className={`${ui.button} px-2 py-1.5 text-sm`} aria-label={`Añadir franja ${label}`}>
                <Plus size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
    </div>
  )
}
