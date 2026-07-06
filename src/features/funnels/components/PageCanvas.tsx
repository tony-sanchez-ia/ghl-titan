'use client'

import { useState } from 'react'
import {
  ArrowDown, ArrowUp, Code2, FileInput, Heading1, Image as ImageIcon, LayoutGrid, Minus,
  MousePointerClick, MoveVertical, Play, Plus, Trash2, Type,
} from 'lucide-react'
import { uid } from '@/shared/lib/uid'
import { LAYOUT_COLUMNS } from '@/shared/lib/section-layout'
import { DEFAULT_SECTION_PADDING, newPageSection } from '../services/design'
import type { PageBlock, PageBlockType, PageDesign, SectionLayout } from '@/types/database'
import { PageBlockView } from './page-render'

const BLOCK_PALETTE: { type: PageBlockType; label: string; icon: typeof Type }[] = [
  { type: 'heading', label: 'Titular', icon: Heading1 },
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'image', label: 'Imagen', icon: ImageIcon },
  { type: 'button', label: 'Botón CTA', icon: MousePointerClick },
  { type: 'video', label: 'Vídeo', icon: Play },
  { type: 'form', label: 'Formulario', icon: FileInput },
  { type: 'divider', label: 'Divisor', icon: Minus },
  { type: 'spacer', label: 'Espaciador', icon: MoveVertical },
  { type: 'html', label: 'Código HTML', icon: Code2 },
]

const DEFAULT_CONFIG: Record<PageBlockType, PageBlock['config']> = {
  heading: { text: '', level: 1, align: 'left' },
  text: { html: '', align: 'left' },
  image: { image_url: '', alt: '' },
  button: { label: 'Quiero saber más', url: '', align: 'center' },
  video: { video_url: '' },
  form: { label: 'Enviar', align: 'center' },
  html: { html: '' },
  divider: {},
  spacer: { height: 40 },
}

const LAYOUT_LABELS: Record<SectionLayout, string> = {
  '1': '1 columna',
  '2': '2 columnas',
  '3': '3 columnas',
  '4': '4 columnas',
  '1/3:2/3': '⅓ + ⅔',
  '2/3:1/3': '⅔ + ⅓',
  '1/4:3/4': '¼ + ¾',
  '3/4:1/4': '¾ + ¼',
}

export interface PageSelection {
  kind: 'block' | 'section'
  id: string
}

/** Lienzo del editor de páginas: mismo lenguaje que el editor de emails (PRP-008). */
export function PageCanvas({
  design,
  setDesign,
  selection,
  setSelection,
  mobile,
}: {
  design: PageDesign
  setDesign: (updater: (d: PageDesign) => PageDesign) => void
  selection: PageSelection | null
  setSelection: (s: PageSelection | null) => void
  mobile: boolean
}) {
  const [inserting, setInserting] = useState<string | null>(null)

  function addSection(layout: SectionLayout, index: number) {
    const section = newPageSection(layout)
    setDesign((d) => ({
      ...d,
      sections: [...d.sections.slice(0, index), section, ...d.sections.slice(index)],
    }))
    setSelection({ kind: 'section', id: section.id })
    setInserting(null)
  }

  function moveSection(id: string, dir: -1 | 1) {
    setDesign((d) => {
      const i = d.sections.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.sections.length) return d
      const sections = [...d.sections]
      ;[sections[i], sections[j]] = [sections[j], sections[i]]
      return { ...d, sections }
    })
  }

  function removeSection(id: string) {
    setDesign((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }))
    if (selection?.kind === 'section' && selection.id === id) setSelection(null)
  }

  function updateColumn(sectionId: string, col: number, updater: (blocks: PageBlock[]) => PageBlock[]) {
    setDesign((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? { ...s, columns: s.columns.map((c, j) => (j === col ? updater(c) : c)) }
          : s
      ),
    }))
  }

  function insertBlock(sectionId: string, col: number, index: number, type: PageBlockType) {
    const block: PageBlock = { id: uid(), type, config: { ...DEFAULT_CONFIG[type] } }
    updateColumn(sectionId, col, (blocks) => [...blocks.slice(0, index), block, ...blocks.slice(index)])
    setSelection({ kind: 'block', id: block.id })
    setInserting(null)
  }

  function moveBlock(sectionId: string, col: number, id: string, dir: -1 | 1) {
    updateColumn(sectionId, col, (blocks) => {
      const i = blocks.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= blocks.length) return blocks
      const copy = [...blocks]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function removeBlock(sectionId: string, col: number, id: string) {
    updateColumn(sectionId, col, (blocks) => blocks.filter((b) => b.id !== id))
    if (selection?.kind === 'block' && selection.id === id) setSelection(null)
  }

  const mode = mobile ? 'mobile' : 'desktop'

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm border border-slate-200"
      style={{ background: design.styles.background_color, color: design.styles.text_color }}
    >
      {design.sections.length === 0 && (
        <p className="p-10 text-center text-sm text-slate-400">La página está vacía. Añade una sección.</p>
      )}

      {design.sections.map((section, si) => (
        <div key={section.id}>
          <SectionInsertPoint
            id={`section:${si}`}
            inserting={inserting}
            setInserting={setInserting}
            onPick={(layout) => addSection(layout, si)}
          />
          <section
            onClick={(e) => {
              e.stopPropagation()
              setSelection({ kind: 'section', id: section.id })
            }}
            className={`relative group/section cursor-pointer ${
              selection?.kind === 'section' && selection.id === section.id
                ? 'ring-2 ring-amber-400 ring-inset'
                : ''
            }`}
            style={{
              background: section.config.background_color ?? 'transparent',
              paddingTop: section.config.padding ?? DEFAULT_SECTION_PADDING,
              paddingBottom: section.config.padding ?? DEFAULT_SECTION_PADDING,
            }}
          >
            {!(selection?.kind === 'section' && selection.id === section.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelection({ kind: 'section', id: section.id }) }}
                className="absolute left-1 top-1 z-10 rounded-md bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-0 group-hover/section:opacity-100 transition-opacity"
                title="Seleccionar sección"
              >
                Sección
              </button>
            )}
            {selection?.kind === 'section' && selection.id === section.id && (
              <div className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-lg bg-amber-500 text-white shadow px-1 py-0.5">
                <span className="px-1 text-[10px] font-semibold uppercase tracking-wide">Sección</span>
                <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, -1) }} disabled={si === 0} className="p-1 disabled:opacity-30" title="Subir sección">
                  <ArrowUp size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, 1) }} disabled={si === design.sections.length - 1} className="p-1 disabled:opacity-30" title="Bajar sección">
                  <ArrowDown size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeSection(section.id) }} className="p-1 text-red-200" title="Quitar sección">
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            <div className="mx-auto w-full max-w-5xl px-6">
              <div className={mobile ? 'flex flex-col' : 'flex items-start gap-x-8'}>
                {section.columns.map((blocks, ci) => (
                  <div
                    key={ci}
                    className="min-w-0 w-full"
                    style={!mobile ? { width: `${LAYOUT_COLUMNS[section.layout][ci]}%` } : undefined}
                  >
                    {blocks.map((block, bi) => (
                      <div key={block.id}>
                        <BlockInsertPoint
                          id={`${section.id}:${ci}:${bi}`}
                          inserting={inserting}
                          setInserting={setInserting}
                          onPick={(type) => insertBlock(section.id, ci, bi, type)}
                        />
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelection({ kind: 'block', id: block.id })
                          }}
                          className={`relative cursor-pointer ${
                            selection?.kind === 'block' && selection.id === block.id
                              ? 'ring-2 ring-primary ring-inset'
                              : 'hover:ring-1 hover:ring-primary/40 hover:ring-inset'
                          }`}
                        >
                          <PageBlockView block={block} styles={design.styles} mode={mode} editor />
                          {selection?.kind === 'block' && selection.id === block.id && (
                            <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-lg bg-slate-900 text-white shadow px-1 py-0.5">
                              <button onClick={(e) => { e.stopPropagation(); moveBlock(section.id, ci, block.id, -1) }} disabled={bi === 0} className="p-1 disabled:opacity-30" title="Subir">
                                <ArrowUp size={13} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); moveBlock(section.id, ci, block.id, 1) }} disabled={bi === blocks.length - 1} className="p-1 disabled:opacity-30" title="Bajar">
                                <ArrowDown size={13} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeBlock(section.id, ci, block.id) }} className="p-1 text-red-300" title="Quitar">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <BlockInsertPoint
                      id={`${section.id}:${ci}:${blocks.length}`}
                      inserting={inserting}
                      setInserting={setInserting}
                      onPick={(type) => insertBlock(section.id, ci, blocks.length, type)}
                      alwaysVisible={blocks.length === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ))}

      <div className="p-3" onClick={(e) => e.stopPropagation()}>
        <SectionInsertPoint
          id={`section:${design.sections.length}`}
          inserting={inserting}
          setInserting={setInserting}
          onPick={(layout) => addSection(layout, design.sections.length)}
          asButton
        />
      </div>
    </div>
  )
}

function LayoutIcon({ layout }: { layout: SectionLayout }) {
  return (
    <div className="flex gap-0.5 w-14 h-7">
      {LAYOUT_COLUMNS[layout].map((w, i) => (
        <div key={i} className="rounded-sm bg-slate-300" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function SectionInsertPoint({
  id, inserting, setInserting, onPick, asButton,
}: {
  id: string
  inserting: string | null
  setInserting: (k: string | null) => void
  onPick: (layout: SectionLayout) => void
  asButton?: boolean
}) {
  if (inserting === id) {
    return (
      <div className="mx-4 my-2 rounded-lg border border-amber-400/60 bg-amber-50/80 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-slate-600 mb-2">Diseño de la sección:</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(LAYOUT_COLUMNS) as SectionLayout[]).map((layout) => (
            <button
              key={layout}
              onClick={(e) => { e.stopPropagation(); onPick(layout) }}
              className="flex flex-col items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-2 text-[10px] text-slate-600 hover:border-amber-400 transition-colors"
              title={LAYOUT_LABELS[layout]}
            >
              <LayoutIcon layout={layout} />
              {LAYOUT_LABELS[layout]}
            </button>
          ))}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setInserting(null) }} className="mt-2 text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
    )
  }
  if (asButton) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setInserting(id) }}
        className="w-full rounded-lg border-2 border-dashed border-slate-300/70 py-2.5 text-sm text-slate-400 hover:text-amber-600 hover:border-amber-400 transition-colors inline-flex items-center justify-center gap-2"
      >
        <LayoutGrid size={15} /> Añadir sección
      </button>
    )
  }
  return (
    <div className="relative h-0 group/sinsert">
      <button
        onClick={(e) => { e.stopPropagation(); setInserting(id) }}
        className="absolute left-6 -translate-y-1/2 z-10 rounded-full bg-white border border-slate-300 text-slate-400 px-1.5 py-0.5 text-[10px] font-medium opacity-0 group-hover/sinsert:opacity-100 hover:text-amber-600 hover:border-amber-400 transition-opacity inline-flex items-center gap-1"
        title="Añadir sección aquí"
      >
        <LayoutGrid size={11} /> Sección
      </button>
    </div>
  )
}

function BlockInsertPoint({
  id, inserting, setInserting, onPick, alwaysVisible,
}: {
  id: string
  inserting: string | null
  setInserting: (k: string | null) => void
  onPick: (type: PageBlockType) => void
  alwaysVisible?: boolean
}) {
  if (inserting === id) {
    return (
      <div className="mx-2 my-1 rounded-lg border border-primary/40 bg-slate-50 p-2 grid grid-cols-2 gap-1" onClick={(e) => e.stopPropagation()}>
        {BLOCK_PALETTE.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.type}
              onClick={(e) => { e.stopPropagation(); onPick(p.type) }}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] text-slate-600 hover:bg-white hover:text-primary transition-colors"
            >
              <Icon size={13} className="shrink-0" />
              {p.label}
            </button>
          )
        })}
        <button
          onClick={(e) => { e.stopPropagation(); setInserting(null) }}
          className="flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] text-slate-400 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    )
  }
  if (alwaysVisible) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setInserting(id) }}
        className="my-2 w-full rounded-md border border-dashed border-slate-300/70 py-2 text-xs text-slate-400 hover:text-primary hover:border-primary transition-colors inline-flex items-center justify-center gap-1"
      >
        <Plus size={12} /> Bloque
      </button>
    )
  }
  return (
    <div className="relative h-0 group/binsert">
      <button
        onClick={(e) => { e.stopPropagation(); setInserting(id) }}
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-white border border-slate-300 text-slate-400 p-0.5 opacity-0 group-hover/binsert:opacity-100 hover:text-primary hover:border-primary transition-opacity"
        title="Añadir bloque"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
