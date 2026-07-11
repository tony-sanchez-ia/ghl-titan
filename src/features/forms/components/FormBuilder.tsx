'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ExternalLink, Globe, Loader2, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { deleteForm, saveFormDesign, setFormStatus, toggleFormAutomation, updateFormMeta } from '@/actions/forms'
import { fieldFromPreset, type FieldPreset } from '../services/schema'
import type { Automation, Form, FormField, FormSchema, FormSettings, FormStyles, FormSubmission } from '@/types/database'
import type { FormStats } from '../services/tracking'
import { FieldPalette } from './FieldPalette'
import { FormCanvas } from './FormCanvas'
import { FieldSettings } from './FieldSettings'
import { FormStylePanel } from './FormStylePanel'
import { SubmitBehaviorPanel } from './SubmitBehaviorPanel'
import { IntegratePanel } from './IntegratePanel'
import { SubmissionsTable } from './SubmissionsTable'
import { FormAnalytics } from './FormAnalytics'

type Tab = 'editar' | 'estilos' | 'enviar' | 'integrar' | 'envios' | 'analisis'
const TABS: { key: Tab; label: string }[] = [
  { key: 'editar', label: 'Editar' },
  { key: 'estilos', label: 'Estilos' },
  { key: 'enviar', label: 'Al enviar' },
  { key: 'integrar', label: 'Integrar' },
  { key: 'envios', label: 'Envíos' },
  { key: 'analisis', label: 'Análisis' },
]

export function FormBuilder({
  form,
  automations,
  linkedAutomationIds,
  submissions,
  stats,
  siteUrl,
}: {
  form: Form
  automations: Pick<Automation, 'id' | 'name' | 'status'>[]
  linkedAutomationIds: string[]
  submissions: FormSubmission[]
  stats: FormStats
  siteUrl: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('editar')
  const [schema, setSchema] = useState<FormSchema>(form.schema)
  const [styles, setStyles] = useState<FormStyles>(form.styles)
  const [settings, setSettings] = useState<FormSettings>(form.settings)
  const [name, setName] = useState(form.name)
  const [status, setStatus] = useState(form.status)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [linked, setLinked] = useState<string[]>(linkedAutomationIds)

  const selectedField = schema.fields.find((f) => f.id === selectedId) ?? null

  // ── Mutadores del schema ──
  function addField(preset: FieldPreset) {
    const field = fieldFromPreset(preset, schema.fields)
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }))
    setSelectedId(field.id)
    setTab('editar')
  }
  function updateField(id: string, patch: Partial<FormField>) {
    setSchema((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  }
  function deleteField(id: string) {
    setSchema((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }
  function moveField(id: string, dir: -1 | 1) {
    setSchema((s) => {
      const i = s.fields.findIndex((f) => f.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.fields.length) return s
      const fields = [...s.fields]
      ;[fields[i], fields[j]] = [fields[j], fields[i]]
      return { ...s, fields }
    })
  }
  function toggleWidth(id: string) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === id ? { ...f, width: f.width === 'half' ? 'full' : 'half' } : f)),
    }))
  }

  // ── Autoguardado (debounce) del diseño ──
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ schema, styles, settings })
  latest.current = { schema, styles, settings }

  const flush = useCallback(async () => {
    setSaveState('saving')
    const res = await saveFormDesign(form.id, latest.current)
    setSaveState(res.error ? 'error' : 'saved')
  }, [form.id])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 800)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [schema, styles, settings, flush])

  async function saveName() {
    if (name.trim() && name !== form.name) await updateFormMeta(form.id, { name: name.trim() })
  }
  async function togglePublish() {
    const next = status === 'published' ? 'draft' : 'published'
    setStatus(next)
    await setFormStatus(form.id, next)
    router.refresh()
  }
  async function onToggleAutomation(automationId: string, link: boolean) {
    setLinked((l) => (link ? [...l, automationId] : l.filter((x) => x !== automationId)))
    await toggleFormAutomation(form.id, automationId, link)
  }
  async function onDelete() {
    if (!confirm('¿Borrar este formulario y todos sus envíos?')) return
    await deleteForm(form.id)
    router.push('/forms')
  }

  const publicUrl = `${siteUrl || ''}/form/${form.slug}`
  const showViewToggle = tab === 'editar' || tab === 'estilos'

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/forms" className={`${ui.button} px-2.5 py-2 text-sm`}>
          <ArrowLeft size={16} />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="flex-1 min-w-40 text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-border"
        />
        <span className="text-xs text-muted inline-flex items-center gap-1.5 w-24 justify-end">
          {saveState === 'saving' && (<><Loader2 size={13} className="animate-spin" /> Guardando…</>)}
          {saveState === 'saved' && (<><Check size={13} /> Guardado</>)}
          {saveState === 'error' && <span className="text-red-600">Error</span>}
        </span>
        {showViewToggle && (
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView('desktop')} className={`px-2.5 py-2 ${view === 'desktop' ? 'bg-primary-soft text-primary' : 'text-muted'}`} title="Escritorio">
              <Monitor size={16} />
            </button>
            <button onClick={() => setView('mobile')} className={`px-2.5 py-2 ${view === 'mobile' ? 'bg-primary-soft text-primary' : 'text-muted'}`} title="Móvil">
              <Smartphone size={16} />
            </button>
          </div>
        )}
        <a href={publicUrl} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
          <ExternalLink size={15} /> Ver
        </a>
        <button onClick={onDelete} className={`${ui.button} px-2.5 py-2 text-sm text-red-600`} title="Borrar formulario">
          <Trash2 size={15} />
        </button>
        <button
          onClick={togglePublish}
          className={status === 'published' ? `${ui.button} px-3 py-2 text-sm` : `${ui.buttonPrimary} px-3 py-2 text-sm`}
        >
          <Globe size={15} /> {status === 'published' ? 'Despublicar' : 'Publicar'}
        </button>
      </div>

      {status !== 'published' && (
        <div className={`${ui.card} p-3 text-sm text-muted`}>
          El formulario está en borrador. Publícalo para captar leads desde el enlace o el código de integración.
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'editar' && (
        <div className="flex gap-4 items-start">
          <div className={`${ui.card} w-56 shrink-0 p-3 sticky top-4`}>
            <FieldPalette onAdd={addField} />
          </div>
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-bg p-4 overflow-x-auto">
            <div className="mx-auto transition-all" style={{ width: view === 'mobile' ? 375 : '100%', maxWidth: '100%' }}>
              <FormCanvas
                schema={schema}
                styles={styles}
                settings={settings}
                selectedId={selectedId}
                mobile={view === 'mobile'}
                onSelect={setSelectedId}
                onMove={moveField}
                onToggleWidth={toggleWidth}
                onDelete={deleteField}
              />
            </div>
          </div>
          <div className={`${ui.card} w-80 shrink-0 p-4 sticky top-4`}>
            {selectedField ? (
              <FieldSettings
                field={selectedField}
                onChange={(patch) => updateField(selectedField.id, patch)}
                onDelete={() => deleteField(selectedField.id)}
              />
            ) : (
              <p className="text-sm text-muted">Pulsa un campo del formulario para editarlo, o añade uno desde la izquierda.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'estilos' && (
        <div className="flex gap-5 items-start">
          <div className={`${ui.card} w-80 shrink-0 p-4`}>
            <FormStylePanel styles={styles} onChange={(patch) => setStyles((s) => ({ ...s, ...patch }))} />
          </div>
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-bg p-4 overflow-x-auto">
            <div className="mx-auto transition-all" style={{ width: view === 'mobile' ? 375 : '100%', maxWidth: '100%' }}>
              <FormCanvas
                schema={schema}
                styles={styles}
                settings={settings}
                selectedId={null}
                mobile={view === 'mobile'}
                onSelect={() => {}}
                onMove={() => {}}
                onToggleWidth={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'enviar' && (
        <div className={`${ui.card} p-5`}>
          <SubmitBehaviorPanel
            settings={settings}
            onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            automations={automations}
            linkedAutomationIds={linked}
            onToggleAutomation={onToggleAutomation}
          />
        </div>
      )}

      {tab === 'integrar' && (
        <IntegratePanel slug={form.slug} siteUrl={siteUrl} published={status === 'published'} />
      )}

      {tab === 'envios' && <SubmissionsTable submissions={submissions} fields={schema.fields} />}

      {tab === 'analisis' && <FormAnalytics stats={stats} />}
    </div>
  )
}
