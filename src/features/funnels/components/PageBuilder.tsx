'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ExternalLink, FlaskConical, Loader2, Monitor, Smartphone, Trophy } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { declareAbWinner, saveStepDesign, saveStepSeo, startAbTest } from '@/actions/funnels'
import type { AbVariantStats } from '../services/queries'
import { DEFAULT_PAGE_STYLES, migratePageDesign } from '../services/design'
import type {
  Form, Funnel, FunnelStep, FunnelStepVariant, PageBlock, PageBlockConfig, PageDesign,
  PageDesignStyles, PageSectionConfig,
} from '@/types/database'
import { PageCanvas, type PageSelection } from './PageCanvas'
import { PageBlockSettings, PageSectionSettings } from './PageBlockSettings'

/** Editor visual de la página de un paso del funnel (edita la variante indicada). */
export function PageBuilder({
  funnel,
  step,
  variant,
  forms,
  aiEnabled,
  abStats,
}: {
  funnel: Funnel
  step: FunnelStep
  variant: FunnelStepVariant
  forms: Form[]
  aiEnabled: boolean
  abStats: AbVariantStats[] | null
}) {
  const router = useRouter()
  const [design, setDesignState] = useState<PageDesign>(() => migratePageDesign(variant.design))
  const [selection, setSelection] = useState<PageSelection | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [seoTitle, setSeoTitle] = useState(step.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(step.seo_description ?? '')

  const setDesign = (updater: (d: PageDesign) => PageDesign) => setDesignState(updater)

  const selectedBlock: PageBlock | null =
    selection?.kind === 'block'
      ? design.sections.flatMap((s) => s.columns.flat()).find((b) => b.id === selection.id) ?? null
      : null
  const selectedSection =
    selection?.kind === 'section' ? design.sections.find((s) => s.id === selection.id) ?? null : null

  function updateBlockConfig(config: PageBlockConfig) {
    if (selection?.kind !== 'block') return
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        columns: s.columns.map((col) => col.map((b) => (b.id === selection.id ? { ...b, config } : b))),
      })),
    }))
  }

  function updateSectionConfig(config: PageSectionConfig) {
    if (selection?.kind !== 'section') return
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === selection.id ? { ...s, config } : s)),
    }))
  }

  function updateStyles(patch: Partial<PageDesignStyles>) {
    setDesign((d) => ({ ...d, styles: { ...d.styles, ...patch } }))
  }

  // ── Autoguardado (debounce), mismo patrón que el editor de emails ──────────
  const firstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(design)
  latest.current = design

  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    const res = await saveStepDesign(variant.id, latest.current)
    setSaveState(res.error ? 'error' : 'saved')
  }, [variant.id])

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
  }, [design, flushSave])

  const publicPath = `/p/${funnel.slug}/${step.slug}`

  return (
    <div className="space-y-5">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/funnels/${funnel.id}`} className={`${ui.button} px-2.5 py-2 text-sm`}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-40">
          <h1 className="text-xl font-bold leading-tight">{step.name}</h1>
          <p className="text-xs text-muted font-mono">{publicPath}</p>
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
        {!step.ab_active && (
          <button
            onClick={async () => {
              const res = await startAbTest(step.id)
              if (res.error) return alert(res.error)
              router.push(`/funnels/${funnel.id}/steps/${step.id}?variant=B`)
              router.refresh()
            }}
            className={`${ui.button} px-3 py-2 text-sm`}
            title="Crea una variante B para comparar conversión"
          >
            <FlaskConical size={15} /> Test A/B
          </button>
        )}
        {funnel.status === 'published' && (
          <a href={publicPath} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
            <ExternalLink size={15} /> Ver página
          </a>
        )}
      </div>

      {funnel.status !== 'published' && (
        <div className={`${ui.card} p-3 text-sm text-muted`}>
          El embudo está en borrador: la página no es visible al público hasta que lo publiques.
        </div>
      )}

      {step.ab_active && (
        <div className={`${ui.card} p-3 flex flex-wrap items-center gap-3`}>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <FlaskConical size={15} className="text-primary" /> Test A/B activo
          </span>
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {(['A', 'B'] as const).map((k) => (
              <Link
                key={k}
                href={`/funnels/${funnel.id}/steps/${step.id}?variant=${k}`}
                className={`px-3 py-1.5 text-sm font-semibold ${
                  variant.variant_key === k ? 'bg-primary-soft text-primary' : 'text-muted'
                }`}
              >
                {k}
              </Link>
            ))}
          </div>
          <span className="text-xs text-muted">
            Editando la variante <strong>{variant.variant_key}</strong>. El tráfico se reparte 50/50
            (cada visitante ve siempre la misma).
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-sm">
            {(abStats ?? []).map((s) => {
              const conv = s.visitors > 0 ? Math.round((s.conversions / s.visitors) * 100) : 0
              return (
                <span key={s.variant_key} className="inline-flex items-center gap-2">
                  <strong>{s.variant_key}</strong>
                  <span className="text-muted text-xs">
                    {s.visitors} visitas · {s.conversions} conversiones ({conv}%)
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Declarar ganadora la variante ${s.variant_key}? La otra se elimina.`)) return
                      const res = await declareAbWinner(step.id, s.variant_key)
                      if (res.error) return alert(res.error)
                      router.push(`/funnels/${funnel.id}/steps/${step.id}`)
                      router.refresh()
                    }}
                    className={`${ui.button} px-2 py-1 text-xs`}
                    title={`Declarar ganadora la variante ${s.variant_key}`}
                  >
                    <Trophy size={12} /> Ganadora
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Lienzo + panel de ajustes */}
      <div className="flex gap-5 items-start">
        <div
          className="flex-1 rounded-xl border border-border bg-bg p-4 overflow-x-auto"
          onClick={() => setSelection(null)}
        >
          <div
            className="mx-auto transition-all"
            style={{ width: view === 'mobile' ? 375 : '100%', maxWidth: '100%' }}
          >
            <PageCanvas
              design={design}
              setDesign={setDesign}
              selection={selection}
              setSelection={setSelection}
              mobile={view === 'mobile'}
            />
          </div>
        </div>

        <div className={`${ui.card} w-80 shrink-0 p-4 sticky top-4`}>
          {selectedBlock && (
            <PageBlockSettings
              block={selectedBlock}
              onChange={updateBlockConfig}
              forms={forms}
              funnelId={funnel.id}
              aiEnabled={aiEnabled}
            />
          )}
          {selectedSection && (
            <PageSectionSettings section={selectedSection} onChange={updateSectionConfig} />
          )}
          {!selectedBlock && !selectedSection && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Estilos de la página</h3>
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
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted">Color del texto</span>
                <input
                  type="color"
                  value={design.styles.text_color}
                  onChange={(e) => updateStyles({ text_color: e.target.value })}
                  className="h-9 w-12 rounded border border-border cursor-pointer bg-card block"
                />
              </label>
              <button
                onClick={() => updateStyles({ ...DEFAULT_PAGE_STYLES })}
                className={`${ui.button} px-2.5 py-1.5 text-xs`}
              >
                Restaurar colores por defecto
              </button>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-semibold text-sm">SEO del paso</h3>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">Título (pestaña y Google)</span>
                  <input
                    className={`${ui.input} text-sm`}
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    onBlur={() => void saveStepSeo(step.id, { seo_title: seoTitle, seo_description: seoDescription })}
                    placeholder={step.name}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted">Descripción</span>
                  <textarea
                    className={`${ui.input} text-sm min-h-20 resize-y`}
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    onBlur={() => void saveStepSeo(step.id, { seo_title: seoTitle, seo_description: seoDescription })}
                    placeholder="Lo que se ve en los resultados de búsqueda…"
                  />
                </label>
              </div>

              <p className="text-xs text-muted">
                Pulsa un bloque o una sección de la página para editarlos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
