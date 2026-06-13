'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Mail, Clock } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  renameAutomation, setAutomationStatus, deleteAutomation, setAutomationTriggers,
  addStep, updateStep, deleteStep,
} from '@/actions/automations'
import type { AutomationStep, Form } from '@/types/database'
import type { AutomationWithDetail } from '../services/queries'

export function AutomationEditor({
  automation,
  forms,
}: {
  automation: AutomationWithDetail
  forms: Form[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(automation.name)
  const active = automation.status === 'active'

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    await fn()
    setBusy(false)
    router.refresh()
  }

  async function onDelete() {
    if (!confirm('¿Borrar esta secuencia?')) return
    setBusy(true)
    const res = await deleteAutomation(automation.id)
    if (res?.error) { setBusy(false); alert(res.error); return }
    router.push('/automations')
  }

  function toggleForm(formId: string, checked: boolean) {
    const next = checked
      ? [...automation.formIds, formId]
      : automation.formIds.filter((id) => id !== formId)
    run(() => setAutomationTriggers(automation.id, next))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== automation.name && run(() => renameAutomation(automation.id, name))}
          className="text-2xl font-bold bg-transparent outline-none focus:bg-bg rounded px-1"
        />
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
            {active ? 'Activa' : 'Borrador'}
          </span>
          <button onClick={() => run(() => setAutomationStatus(automation.id, active ? 'draft' : 'active'))} disabled={busy} className={`${ui.button} px-3 py-2 text-sm`}>
            {active ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onDelete} disabled={busy} className={`${ui.button} px-3 py-2 text-sm text-red-600`}><Trash2 size={16} /></button>
        </div>
      </div>

      {!active && (
        <div className={`${ui.card} p-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900`}>
          La secuencia está en borrador: no inscribe contactos ni envía emails hasta que la actives.
        </div>
      )}

      {/* Formularios que la disparan */}
      <div className={`${ui.card} p-5`}>
        <h2 className="font-semibold mb-3">Formularios que activan esta secuencia</h2>
        {forms.length === 0 ? (
          <p className="text-sm text-muted">No hay formularios. Crea uno primero.</p>
        ) : (
          <div className="space-y-2">
            {forms.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={automation.formIds.includes(f.id)}
                  onChange={(e) => toggleForm(f.id, e.target.checked)}
                  disabled={busy}
                />
                {f.name} <span className="text-muted">/form/{f.slug}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Pasos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Emails de la secuencia</h2>
          <button onClick={() => run(() => addStep(automation.id))} disabled={busy} className={`${ui.button} px-3 py-2 text-sm`}>
            <Plus size={15} /> Añadir email
          </button>
        </div>
        {automation.steps.length === 0 ? (
          <div className={`${ui.card} p-8 text-center text-muted`}>
            <Mail size={32} className="mx-auto opacity-50" />
            <p className="mt-2">Añade el primer email de la secuencia.</p>
          </div>
        ) : (
          automation.steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} automationId={automation.id} busy={busy} onChanged={() => router.refresh()} />
          ))
        )}
      </div>
    </div>
  )
}

function StepCard({
  step, index, automationId, busy, onChanged,
}: {
  step: AutomationStep
  index: number
  automationId: string
  busy: boolean
  onChanged: () => void
}) {
  const [delayValue, setDelayValue] = useState(step.delay_value)
  const [delayUnit, setDelayUnit] = useState(step.delay_unit)
  const [subject, setSubject] = useState(step.subject)
  const [body, setBody] = useState(step.body)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await updateStep(step.id, automationId, {
      delay_value: delayValue,
      delay_unit: delayUnit,
      subject,
      body,
    })
    setSaving(false)
    setMsg(res?.error ? res.error : 'Guardado')
    onChanged()
  }

  return (
    <div className={`${ui.card} p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Email {index + 1}</span>
        <button onClick={() => deleteStep(step.id, automationId).then(onChanged)} className="text-muted hover:text-red-600 p-1"><Trash2 size={16} /></button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock size={15} className="text-muted" />
        <span className="text-muted">{index === 0 ? 'Enviar' : 'Esperar'}</span>
        <input type="number" min={0} value={delayValue} onChange={(e) => setDelayValue(Number(e.target.value))} className={`${ui.input} w-20`} />
        <select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as 'days' | 'hours')} className={`${ui.input} w-auto`}>
          <option value="days">días</option>
          <option value="hours">horas</option>
        </select>
        <span className="text-muted">{index === 0 ? 'tras el alta' : 'tras el anterior'}</span>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Asunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={ui.input} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Mensaje</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={ui.input} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || busy} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
          {saving ? 'Guardando...' : 'Guardar email'}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  )
}
