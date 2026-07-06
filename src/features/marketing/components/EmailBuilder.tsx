'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, LayoutTemplate, Loader2, Monitor, Send, Smartphone, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  cancelSchedule, deleteCampaign, renameCampaign, saveAsTemplate, saveCampaignDesign, sendCampaignTest,
} from '@/actions/marketing'
import { DEFAULT_STYLES, migrateDesign } from '../services/design'
import type {
  EmailBlock, EmailCampaign, EmailDesign, EmailDesignStyles, EmailSectionConfig, Form,
} from '@/types/database'
import { BlockSettings } from './blocks/BlockSettings'
import { SectionCanvas, type CanvasSelection } from './SectionCanvas'
import { SectionSettings } from './SectionSettings'
import { SendDialog } from './SendDialog'

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
}

export function EmailBuilder({
  campaign,
  allTags,
  forms,
}: {
  campaign: EmailCampaign
  allTags: string[]
  forms: Form[]
}) {
  const router = useRouter()
  const editable = campaign.status === 'draft' || campaign.status === 'scheduled'

  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [design, setDesignState] = useState<EmailDesign>(() => migrateDesign(campaign.design))
  const [selection, setSelection] = useState<CanvasSelection | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [sendOpen, setSendOpen] = useState(false)

  const setDesign = (updater: (d: EmailDesign) => EmailDesign) => setDesignState(updater)

  const selectedBlock: EmailBlock | null =
    selection?.kind === 'block'
      ? design.sections.flatMap((s) => s.columns.flat()).find((b) => b.id === selection.id) ?? null
      : null
  const selectedSection =
    selection?.kind === 'section'
      ? design.sections.find((s) => s.id === selection.id) ?? null
      : null

  function updateBlockConfig(config: EmailBlock['config']) {
    if (selection?.kind !== 'block') return
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        columns: s.columns.map((col) =>
          col.map((b) => (b.id === selection.id ? { ...b, config } : b))
        ),
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

  // ── Autoguardado (debounce) ────────────────────────────────────────────────
  const firstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ subject, design })
  latest.current = { subject, design }

  const flushSave = useCallback(async (): Promise<{ error?: string } | void> => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    const res = await saveCampaignDesign(campaign.id, latest.current)
    setSaveState(res.error ? 'error' : 'saved')
    return res
  }, [campaign.id])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!editable) return
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushSave(), 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [subject, design, editable, flushSave])

  // ── Acciones de cabecera ───────────────────────────────────────────────────
  async function onSendTest() {
    setTestState('sending')
    if (editable) {
      const saved = await flushSave()
      if (saved && 'error' in saved && saved.error) {
        setTestState('idle')
        alert(saved.error)
        return
      }
    }
    const res = await sendCampaignTest(campaign.id)
    if (res.error) {
      setTestState('idle')
      alert(res.error)
      return
    }
    setTestState('sent')
    setTimeout(() => setTestState('idle'), 4000)
  }

  async function onSaveTemplate() {
    const tplName = prompt('Nombre de la plantilla:', campaign.name)
    if (!tplName) return
    if (editable) {
      const saved = await flushSave()
      if (saved && 'error' in saved && saved.error) return alert(saved.error)
    }
    const res = await saveAsTemplate(campaign.id, tplName)
    alert(res.error ?? 'Plantilla guardada')
  }

  async function onDelete() {
    if (!confirm('¿Borrar esta campaña?')) return
    const res = await deleteCampaign(campaign.id)
    if (res.error) return alert(res.error)
    router.push('/marketing?tab=campaigns')
  }

  return (
    <div className="space-y-5">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/marketing?tab=campaigns" className={`${ui.button} px-2.5 py-2 text-sm`}>
          <ArrowLeft size={16} />
        </Link>
        <input
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== campaign.name && renameCampaign(campaign.id, name)}
          className="flex-1 min-w-40 text-xl font-bold bg-transparent outline-none focus:bg-bg rounded px-1"
        />
        <span className="text-xs px-2 py-1 rounded-full bg-bg text-muted">{STATUS_LABEL[campaign.status]}</span>
        {editable && (
          <span className="text-xs text-muted inline-flex items-center gap-1.5 w-24">
            {saveState === 'saving' && <><Loader2 size={13} className="animate-spin" /> Guardando…</>}
            {saveState === 'saved' && <><Check size={13} /> Guardado</>}
            {saveState === 'error' && <span className="text-red-600">Error al guardar</span>}
          </span>
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
        <button onClick={onSaveTemplate} className={`${ui.button} px-3 py-2 text-sm`} title="Guardar como plantilla">
          <LayoutTemplate size={16} />
        </button>
        <button onClick={onSendTest} disabled={testState === 'sending'} className={`${ui.button} px-3 py-2 text-sm`}>
          {testState === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {testState === 'sent' ? '¡Prueba enviada!' : 'Enviarme una prueba'}
        </button>
        {editable && (
          <button
            onClick={async () => {
              const saved = await flushSave()
              if (saved && 'error' in saved && saved.error) return alert(saved.error)
              setSendOpen(true)
            }}
            className={`${ui.buttonPrimary} px-3 py-2 text-sm`}
          >
            <Send size={16} /> Enviar o programar
          </button>
        )}
        <button onClick={onDelete} className={`${ui.button} px-3 py-2 text-sm text-red-600`} title="Borrar campaña">
          <Trash2 size={16} />
        </button>
      </div>

      {campaign.status === 'scheduled' && campaign.scheduled_at && (
        <div className={`${ui.card} p-3 text-sm flex flex-wrap items-center justify-between gap-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900`}>
          <span>
            Programada para el{' '}
            {new Date(campaign.scheduled_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}.
          </span>
          <button
            onClick={async () => {
              const res = await cancelSchedule(campaign.id)
              if (res.error) return alert(res.error)
              router.refresh()
            }}
            className={`${ui.button} px-2.5 py-1.5 text-xs`}
          >
            Cancelar programación
          </button>
        </div>
      )}

      {/* Asunto */}
      <div className={`${ui.card} p-4 flex items-center gap-3`}>
        <span className="text-sm font-medium text-muted shrink-0">Asunto:</span>
        <input
          value={subject}
          disabled={!editable}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="El asunto que verán tus contactos (admite {{nombre}})"
          className="flex-1 bg-transparent outline-none text-sm focus:bg-bg rounded px-1 py-1"
        />
      </div>

      {!editable && (
        <div className={`${ui.card} p-3 text-sm text-muted`}>
          Esta campaña ya {campaign.status === 'sent' ? 'se envió' : 'se está enviando'}: el diseño no se puede modificar.
        </div>
      )}

      {/* Lienzo + panel de ajustes */}
      <div className="flex gap-5 items-start">
        <div
          className="flex-1 rounded-xl border border-border p-6 overflow-x-auto"
          style={{ background: design.styles.background_color }}
          onClick={() => setSelection(null)}
        >
          <div
            className="mx-auto transition-all"
            style={{ width: view === 'mobile' ? 375 : 600, maxWidth: '100%' }}
          >
            <SectionCanvas
              design={design}
              setDesign={setDesign}
              selection={selection}
              setSelection={setSelection}
              editable={editable}
              mobile={view === 'mobile'}
              buttonColor={design.styles.button_color}
            />
            <p className="py-3 text-center text-xs text-slate-400">
              Recibes este email porque estás en nuestra lista de contactos. · <span className="underline">Darse de baja</span>
            </p>
          </div>
        </div>

        {editable && (
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
                <button
                  onClick={() => updateStyles({ ...DEFAULT_STYLES })}
                  className={`${ui.button} px-2.5 py-1.5 text-xs`}
                >
                  Restaurar colores por defecto
                </button>
                <p className="text-xs text-muted">
                  Pulsa un bloque o una sección del email para editarlos. Estos colores se aplican a
                  todo el email.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {sendOpen && (
        <SendDialog campaignId={campaign.id} allTags={allTags} onClose={() => setSendOpen(false)} />
      )}
    </div>
  )
}
