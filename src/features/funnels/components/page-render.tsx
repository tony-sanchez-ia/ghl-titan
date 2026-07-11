import { Code2, FileInput, ImageIcon, MousePointerClick, Play, Type } from 'lucide-react'
import { LAYOUT_COLUMNS } from '@/shared/lib/section-layout'
// Normalizador de URLs de vídeo (YouTube/Vimeo/Bunny) del módulo de cursos
import { toEmbedUrl } from '@/features/courses/services/embed'
import { DEFAULT_SECTION_PADDING } from '../services/design'
import type { PageBlock, PageDesign, PageDesignStyles, PageSection } from '@/types/database'
import { EmbeddedFunnelForm } from './EmbeddedFunnelForm'
import { FunnelTracker } from './FunnelTracker'

/**
 * Render PURO de una página de funnel (sin hooks ni handlers propios): lo usan el
 * lienzo del editor (cliente) y la página pública (RSC). El HTML de los bloques
 * llega SIEMPRE saneado desde el servidor (sanitize.ts al guardar).
 *
 * mode: 'public' = responsive real (apila en móvil) · 'desktop'/'mobile' = preview del editor
 * track: contexto de la visita pública (paso/variante/siguiente paso) para
 *        formulario embebido y medición de clicks. Sin track, los bloques
 *        interactivos se muestran como elementos estáticos (editor).
 */
export type PageRenderMode = 'public' | 'desktop' | 'mobile'

export interface PageTrackContext {
  // null = página de sitio web (sin métricas de funnel; el form sigue creando contactos)
  stepId: string | null
  variantId: string | null
  nextUrl: string | null
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

const HEADING_CLASSES: Record<1 | 2 | 3, Record<'fluid' | 'fixed', string>> = {
  1: { fluid: 'text-4xl md:text-5xl font-extrabold leading-tight', fixed: 'text-5xl font-extrabold leading-tight' },
  2: { fluid: 'text-2xl md:text-3xl font-bold leading-snug', fixed: 'text-3xl font-bold leading-snug' },
  3: { fluid: 'text-lg md:text-xl font-semibold leading-normal', fixed: 'text-xl font-semibold leading-normal' },
}

function EmptyHint({ icon: Icon, children }: { icon: typeof Type; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300/60 py-8 px-4 text-center text-sm text-slate-400">
      <Icon size={18} className="inline-block mb-1" />
      <div>{children}</div>
    </div>
  )
}

/** Un bloque de página. En editor (editor=true) los bloques vacíos muestran una pista. */
export function PageBlockView({
  block,
  styles,
  mode,
  editor,
  track,
}: {
  block: PageBlock
  styles: PageDesignStyles
  mode: PageRenderMode
  editor?: boolean
  track?: PageTrackContext
}) {
  const c = block.config
  const align = ALIGN[c.align ?? 'left']
  const sizing = mode === 'public' ? 'fluid' : mode === 'mobile' ? 'fluid' : 'fixed'

  switch (block.type) {
    case 'heading': {
      if (!c.text) return editor ? <EmptyHint icon={Type}>Escribe el titular…</EmptyHint> : null
      const cls = HEADING_CLASSES[c.level ?? 1][sizing === 'fixed' ? 'fixed' : 'fluid']
      const Tag = (['h1', 'h2', 'h3'] as const)[(c.level ?? 1) - 1]
      return <Tag className={`py-3 break-words ${cls} ${align}`}>{c.text}</Tag>
    }
    case 'text':
      if (!c.html) return editor ? <EmptyHint icon={Type}>Escribe tu texto…</EmptyHint> : null
      return (
        <div
          className={`py-2.5 text-base md:text-lg leading-relaxed break-words ${align} [&_a]:underline`}
          dangerouslySetInnerHTML={{ __html: c.html }}
        />
      )
    case 'image':
      if (!c.image_url)
        return editor ? <EmptyHint icon={ImageIcon}>Añade la URL de una imagen</EmptyHint> : null
      {
        // eslint-disable-next-line @next/next/no-img-element
        const img = <img src={c.image_url} alt={c.alt ?? ''} className="inline-block max-w-full rounded-xl" />
        return (
          <div className={`py-3 ${align}`}>
            {c.link_url && mode === 'public' ? <a href={c.link_url}>{img}</a> : img}
          </div>
        )
      }
    case 'button':
      if (!c.label)
        return editor ? <EmptyHint icon={MousePointerClick}>Configura el botón…</EmptyHint> : null
      return (
        <div className={`py-4 ${align}`}>
          <a
            href={mode === 'public' ? c.url || '#' : undefined}
            data-cta={block.id}
            className="inline-block rounded-lg px-8 py-3.5 text-base md:text-lg font-semibold text-white shadow-sm cursor-pointer"
            style={{ background: styles.button_color }}
          >
            {c.label}
          </a>
        </div>
      )
    case 'video': {
      if (!c.video_url)
        return editor ? <EmptyHint icon={Play}>Pega el enlace de un vídeo (YouTube, Vimeo…)</EmptyHint> : null
      return (
        <div className="py-3">
          <iframe
            src={toEmbedUrl(c.video_url)}
            className={`w-full aspect-video rounded-xl border-0 ${editor ? 'pointer-events-none' : ''}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Vídeo"
          />
        </div>
      )
    }
    case 'form':
      if (!c.form_slug)
        return editor ? <EmptyHint icon={FileInput}>Elige un formulario de captura</EmptyHint> : null
      // Público: formulario embebido real (contacto al CRM + automatizaciones + salto de paso)
      if (mode === 'public' && track) {
        return (
          <div className={`py-4 ${ALIGN[c.align ?? 'center']}`}>
            <EmbeddedFunnelForm
              formSlug={c.form_slug}
              stepId={track.stepId}
              variantId={track.variantId}
              nextUrl={track.nextUrl}
              buttonColor={styles.button_color}
              buttonLabel={c.label || 'Enviar'}
            />
          </div>
        )
      }
      // Editor: representación estática del formulario
      return (
        <div className={`py-4 ${ALIGN[c.align ?? 'center']}`}>
          <div className="mx-auto max-w-md space-y-2 text-left">
            {['Tu nombre', 'Tu email', 'Tu teléfono (opcional)'].map((ph) => (
              <div
                key={ph}
                className="rounded-lg border border-black/15 bg-white px-3 py-2.5 text-[15px] text-slate-400"
              >
                {ph}
              </div>
            ))}
            <div
              className="rounded-lg px-8 py-3.5 text-center text-base font-semibold text-white"
              style={{ background: styles.button_color }}
            >
              {c.label || 'Enviar'}
            </div>
          </div>
        </div>
      )
    case 'html':
      if (!c.html) return editor ? <EmptyHint icon={Code2}>Pega tu código HTML (avanzado)</EmptyHint> : null
      // saneado en el servidor al guardar (sanitizeRawHtml)
      return <div className="py-2" dangerouslySetInnerHTML={{ __html: c.html }} />
    case 'divider':
      return (
        <div className="py-4">
          <div className="border-t border-current opacity-15" />
        </div>
      )
    case 'spacer':
      return <div style={{ height: Math.min(Math.max(c.height ?? 40, 4), 240) }} />
  }
}

/** Contenido de una sección: contenedor centrado + columnas del layout. */
export function PageSectionInner({
  section,
  styles,
  mode,
  track,
}: {
  section: PageSection
  styles: PageDesignStyles
  mode: PageRenderMode
  track?: PageTrackContext
}) {
  const rowClass =
    mode === 'public' ? 'flex flex-col md:flex-row md:items-start' : mode === 'mobile' ? 'flex flex-col' : 'flex items-start'

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <div className={`${rowClass} gap-x-8`}>
        {section.columns.map((blocks, ci) => (
          <div
            key={ci}
            className="min-w-0 w-full"
            style={
              mode === 'desktop'
                ? { width: `${LAYOUT_COLUMNS[section.layout][ci]}%` }
                : mode === 'public'
                  ? ({ '--col-w': `${LAYOUT_COLUMNS[section.layout][ci]}%` } as React.CSSProperties)
                  : undefined
            }
            {...(mode === 'public' ? { 'data-col': '' } : {})}
          >
            {blocks.map((block) => (
              <PageBlockView key={block.id} block={block} styles={styles} mode={mode} track={track} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Página completa (render público). El editor usa PageSectionInner directamente. */
export function PageView({
  design,
  mode = 'public',
  track,
}: {
  design: PageDesign
  mode?: PageRenderMode
  track?: PageTrackContext
}) {
  return (
    <div
      className="min-h-screen"
      style={{ background: design.styles.background_color, color: design.styles.text_color }}
    >
      {/* En público, las columnas vuelven a su ancho proporcional a partir de md */}
      <style>{`@media (min-width: 768px){ [data-col]{ width: var(--col-w, 100%) !important; } }`}</style>
      {track?.stepId && track.variantId && (
        <FunnelTracker stepId={track.stepId} variantId={track.variantId} />
      )}
      {design.sections.map((s) => (
        <section
          key={s.id}
          style={{
            background: s.config.background_color ?? 'transparent',
            paddingTop: s.config.padding ?? DEFAULT_SECTION_PADDING,
            paddingBottom: s.config.padding ?? DEFAULT_SECTION_PADDING,
          }}
        >
          <PageSectionInner section={s} styles={design.styles} mode={mode} track={track} />
        </section>
      ))}
    </div>
  )
}
