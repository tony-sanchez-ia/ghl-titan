'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowDown, ArrowUp, Check, LayoutTemplate, Loader2, Minus, Monitor, MousePointerClick,
  MoveVertical, PanelBottom, PanelTop, Plus, Send, Smartphone, Trash2, Type, Image as ImageIcon,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  cancelSchedule, deleteCampaign, renameCampaign, saveAsTemplate, saveCampaignDesign, sendCampaignTest,
} from '@/actions/marketing'
import type { EmailBlock, EmailBlockType, EmailCampaign } from '@/types/database'
import { BlockPreview } from './blocks/BlockPreview'
import { BlockSettings } from './blocks/BlockSettings'
import { SendDialog } from './SendDialog'

const PALETTE: { type: EmailBlockType; label: string; icon: typeof Type }[] = [
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'image', label: 'Imagen', icon: ImageIcon },
  { type: 'button', label: 'Botón', icon: MousePointerClick },
  { type: 'divider', label: 'Divisor', icon: Minus },
  { type: 'spacer', label: 'Espaciador', icon: MoveVertical },
  { type: 'header', label: 'Cabecera', icon: PanelTop },
  { type: 'footer', label: 'Pie de página', icon: PanelBottom },
]

const DEFAULT_CONFIG: Record<EmailBlockType, EmailBlock['config']> = {
  header: { title: '' },
  text: { text: '', size: 'normal', align: 'left' },
  image: { image_url: '', alt: '' },
  button: { label: 'Más información', url: '', align: 'center' },
  divider: {},
  spacer: { height: 24 },
  footer: { footer_text: '' },
}

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
}

export function EmailBuilder({ campaign, allTags }: { campaign: EmailCampaign; allTags: string[] }) {
  const router = useRouter()
  const editable = campaign.status === 'draft' || campaign.status === 'scheduled'

  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [design, setDesign] = useState<EmailBlock[]>(campaign.design)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [inserting, setInserting] = useState<number | null>(null) // índice donde se está insertando
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [sendOpen, setSendOpen] = useState(false)

  const selected = design.find((b) => b.id === selectedId) ?? null

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

  // ── Operaciones sobre bloques ──────────────────────────────────────────────
  function insertBlock(type: EmailBlockType, index: number) {
    const block: EmailBlock = { id: crypto.randomUUID(), type, config: { ...DEFAULT_CONFIG[type] } }
    setDesign((d) => [...d.slice(0, index), block, ...d.slice(index)])
    setSelectedId(block.id)
    setInserting(null)
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setDesign((d) => {
      const i = d.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.length) return d
      const copy = [...d]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function removeBlock(id: string) {
    setDesign((d) => d.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function updateSelected(config: EmailBlock['config']) {
    setDesign((d) => d.map((b) => (b.id === selectedId ? { ...b, config } : b)))
  }

  // ── Acciones de cabecera ───────────────────────────────────────────────────
  async function onSendTest() {
    setTestState('sending')
    const saved = await flushSave()
    if (saved && 'error' in saved && saved.error) {
      setTestState('idle')
      alert(saved.error)
      return
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
        <button
          onClick={async () => {
            const tplName = prompt('Nombre de la plantilla:', campaign.name)
            if (!tplName) return
            if (editable) {
              const saved = await flushSave()
              if (saved && 'error' in saved && saved.error) return alert(saved.error)
            }
            const res = await saveAsTemplate(campaign.id, tplName)
            alert(res.error ?? 'Plantilla guardada')
          }}
          className={`${ui.button} px-3 py-2 text-sm`}
          title="Guardar como plantilla"
        >
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
        <div className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-900/40 border border-border p-6 overflow-x-auto">
          <div
            className="mx-auto transition-all"
            style={{ width: view === 'mobile' ? 375 : 600, maxWidth: '100%' }}
          >
            <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden shadow-sm">
              {design.length === 0 && (
                <p className="p-10 text-center text-sm text-slate-400">El email está vacío. Añade un bloque.</p>
              )}
              {design.map((block, i) => (
                <div key={block.id}>
                  {editable && <InsertPoint index={i} inserting={inserting} setInserting={setInserting} insertBlock={insertBlock} />}
                  <div
                    onClick={editable ? () => setSelectedId(block.id) : undefined}
                    className={`relative group ${editable ? 'cursor-pointer' : ''} ${
                      selectedId === block.id
                        ? 'ring-2 ring-primary ring-inset'
                        : editable
                          ? 'hover:ring-1 hover:ring-primary/40 hover:ring-inset'
                          : ''
                    }`}
                  >
                    <BlockPreview block={block} />
                    {editable && selectedId === block.id && (
                      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-lg bg-slate-900 text-white shadow px-1 py-0.5">
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1) }} disabled={i === 0} className="p-1 disabled:opacity-30" title="Subir">
                          <ArrowUp size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1) }} disabled={i === design.length - 1} className="p-1 disabled:opacity-30" title="Bajar">
                          <ArrowDown size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }} className="p-1 text-red-300" title="Quitar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {editable && <InsertPoint index={design.length} inserting={inserting} setInserting={setInserting} insertBlock={insertBlock} />}
              <div className="h-5" />
            </div>
            <p className="py-3 text-center text-xs text-slate-400">
              Recibes este email porque estás en nuestra lista de contactos. · <span className="underline">Darse de baja</span>
            </p>
          </div>
        </div>

        {editable && selected && (
          <div className={`${ui.card} w-80 shrink-0 p-4 sticky top-4`}>
            <BlockSettings block={selected} onChange={updateSelected} />
          </div>
        )}
      </div>

      {sendOpen && (
        <SendDialog campaignId={campaign.id} allTags={allTags} onClose={() => setSendOpen(false)} />
      )}
    </div>
  )
}

/** Punto de inserción entre bloques: "+" que abre la paleta. */
function InsertPoint({
  index, inserting, setInserting, insertBlock,
}: {
  index: number
  inserting: number | null
  setInserting: (i: number | null) => void
  insertBlock: (type: EmailBlockType, index: number) => void
}) {
  if (inserting === index) {
    return (
      <div className="mx-8 my-1 rounded-lg border border-primary/40 bg-slate-50 p-2 grid grid-cols-4 gap-1">
        {PALETTE.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.type}
              onClick={() => insertBlock(p.type, index)}
              className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-slate-600 hover:bg-white hover:text-primary transition-colors"
            >
              <Icon size={15} />
              {p.label}
            </button>
          )
        })}
        <button
          onClick={() => setInserting(null)}
          className="flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] text-slate-400 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    )
  }
  return (
    <div className="relative h-0 group/insert">
      <button
        onClick={(e) => { e.stopPropagation(); setInserting(index) }}
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-white border border-slate-300 text-slate-400 p-0.5 opacity-0 group-hover/insert:opacity-100 hover:text-primary hover:border-primary transition-opacity"
        title="Añadir bloque"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
