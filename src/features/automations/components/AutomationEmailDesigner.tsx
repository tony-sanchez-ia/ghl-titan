'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Monitor, Smartphone } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { updateNode } from '@/actions/automations'
import { DEFAULT_STYLES, migrateDesign, defaultDesign, designIsEmpty } from '@/features/marketing/services/design'
import { SectionCanvas, type CanvasSelection } from '@/features/marketing/components/SectionCanvas'
import { SectionSettings } from '@/features/marketing/components/SectionSettings'
import { BlockSettings } from '@/features/marketing/components/blocks/BlockSettings'
import type {
  AutomationNode, EmailBlock, EmailDesign, EmailDesignStyles, EmailSectionConfig, Form,
  StoredEmailDesign,
} from '@/types/database'

interface TemplateOption {
  id: string
  name: string
  design: StoredEmailDesign
}

/**
 * Diseñador del email de un paso "Enviar email" de una automatización.
 * Mismo lienzo que las campañas de Marketing; guarda en el config del nodo
 * (email_mode='designed' + design V2) con autosave.
 */
export function AutomationEmailDesigner({
  automationId,
  automationName,
  node,
  templates,
  forms,
}: {
  automationId: string
  automationName: string
  node: AutomationNode
  templates: TemplateOption[]
  forms: Form[]
}) {
  const [subject, setSubject] = useState(node.config.subject ?? '')
  const [design, setDesignState] = useState<EmailDesign>(() =>
    node.config.design ? migrateDesign(node.config.design) : defaultDesign()
  )
  const [selection, setSelection] = useState<CanvasSelection | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')

  const setDesign = (updater: (d: EmailDesign) => EmailDesign) => setDesignState(updater)

  const selectedBlock: EmailBlock | null =
    selection?.kind === 'block'
      ? design.sections.flatMap((s) => s.columns.flat()).find((b) => b.id === selection.id) ?? null
      : null
  const selectedSection =
    selection?.kind === 'section' ? design.sections.find((s) => s.id === selection.id) ?? null : null

  function updateBlockConfig(config: EmailBlock['config']) {
    if (selection?.kind !== 'block') return
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        columns: s.columns.map((col) => col.map((b) => (b.id === selection.id ? { ...b, config } : b))),
      })),
    }))
  }

  function updateSectionConfig(config: EmailSectionConfig) {
    if (selection?.kind !== 'section') return
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === selection.id ? { ...s, config } : s)),
    }))
  }

  function updateStyles(patch: Partial<EmailDesignStyles>) {
    setDesign((d) => ({ ...d, styles: { ...d.styles, ...patch } }))
  }

  function loadTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (!designIsEmpty(design) && !confirm('¿Sustituir el diseño actual por la plantilla?')) return
    setDesignState(migrateDesign(tpl.design))
    setSelection(null)
  }

  // ── Autosave (debounce) en el config del nodo ──────────────────────────────
  const firstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ subject, design })
  latest.current = { subject, design }

  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    const res = await updateNode(node.id, automationId, {
      subject: latest.current.subject,
      email_mode: 'designed',
      design: latest.current.design,
    })
    setSaveState(res.error ? 'error' : 'saved')
  }, [node.id, automationId])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [subject, design, flushSave])

  return (
    <div className="space-y-5">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/automations/${automationId}`} className={`${ui.button} px-2.5 py-2 text-sm`}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-40">
          <h1 className="text-xl font-bold leading-tight">Email de la automatización</h1>
          <p className="text-xs text-muted">{automationName}</p>
        </div>
        <span className="text-xs text-muted inline-flex items-center gap-1.5 w-24">
          {saveState === 'saving' && (
            <>
              <Loader2 size={13} className="animate-spin" /> Guardando…
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check size={13} /> Guardado
            </>
          )}
          {saveState === 'error' && <span className="text-red-600">Error al guardar</span>}
        </span>
        {templates.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) loadTemplate(e.target.value)
              e.target.value = ''
            }}
            className={`${ui.input} w-auto text-sm`}
          >
            <option value="">Cargar plantilla…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('desktop')}
            className={`px-2.5 py-2 ${view === 'desktop' ? 'bg-primary-soft text-primary' : 'text-muted'}`}
            title="Vista escritorio"
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => setView('mobile')}
            className={`px-2.5 py-2 ${view === 'mobile' ? 'bg-primary-soft text-primary' : 'text-muted'}`}
            title="Vista móvil"
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>

      {/* Asunto */}
      <div className={`${ui.card} p-4 flex items-center gap-3`}>
        <span className="text-sm font-medium text-muted shrink-0">Asunto:</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="El asunto que verá el contacto (admite {{nombre}})"
          className="flex-1 bg-transparent outline-none text-sm focus:bg-bg rounded px-1 py-1"
        />
      </div>

      {/* Lienzo + panel de ajustes */}
      <div className="flex gap-5 items-start">
        <div
          className="flex-1 rounded-xl border border-border p-6 overflow-x-auto"
          style={{ background: design.styles.background_color }}
          onClick={() => setSelection(null)}
        >
          <div className="mx-auto transition-all" style={{ width: view === 'mobile' ? 375 : 600, maxWidth: '100%' }}>
            <SectionCanvas
              design={design}
              setDesign={setDesign}
              selection={selection}
              setSelection={setSelection}
              editable
              mobile={view === 'mobile'}
              buttonColor={design.styles.button_color}
            />
            <p className="py-3 text-center text-xs text-slate-400">
              Recibes este email porque estás en nuestra lista de contactos. ·{' '}
              <span className="underline">Darse de baja</span>
            </p>
          </div>
        </div>

        <div className={`${ui.card} w-80 shrink-0 p-4 sticky top-4`}>
          {selectedBlock && <BlockSettings block={selectedBlock} onChange={updateBlockConfig} forms={forms} />}
          {selectedSection && <SectionSettings section={selectedSection} onChange={updateSectionConfig} />}
          {!selectedBlock && !selectedSection && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Estilos del email</h3>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">Color de fondo</span>
                <input
                  type="color"
                  value={design.styles.background_color}
                  onChange={(e) => updateStyles({ background_color: e.target.value })}
                  className="h-9 w-12 rounded border border-border cursor-pointer bg-card block"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">Color de los botones</span>
                <input
                  type="color"
                  value={design.styles.button_color}
                  onChange={(e) => updateStyles({ button_color: e.target.value })}
                  className="h-9 w-12 rounded border border-border cursor-pointer bg-card block"
                />
              </label>
              <button onClick={() => updateStyles({ ...DEFAULT_STYLES })} className={`${ui.button} px-2.5 py-1.5 text-xs`}>
                Restaurar colores por defecto
              </button>
              <p className="text-xs text-muted">
                Pulsa un bloque o una sección del email para editarlos. Los enlaces y botones se
                rastrean automáticamente (ramas por click).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
