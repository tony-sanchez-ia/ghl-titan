import { uid } from '@/shared/lib/uid'
import { LAYOUT_COLUMNS } from '@/shared/lib/section-layout'
import type { PageBlock, PageDesign, PageSection, SectionLayout } from '@/types/database'

export const DEFAULT_PAGE_STYLES = {
  background_color: '#ffffff',
  button_color: '#2563eb',
  text_color: '#0f172a',
} as const

export const DEFAULT_SECTION_PADDING = 48

export function newPageSection(layout: SectionLayout, blocks: PageBlock[] = []): PageSection {
  return {
    id: uid(),
    layout,
    config: {},
    columns: LAYOUT_COLUMNS[layout].map((_, i) => (i === 0 ? blocks : [])),
  }
}

/** Diseño inicial de la variante A de un paso nuevo (página vacía). */
export function defaultPageDesign(): PageDesign {
  return { version: 1, styles: { ...DEFAULT_PAGE_STYLES }, sections: [] }
}

/**
 * Normaliza lo que venga de BD a un PageDesign válido. La variante se crea
 * siempre con un diseño completo, pero el default de la columna es '{}':
 * cualquier cosa que no sea versión 1 se sustituye por el diseño vacío.
 */
export function migratePageDesign(raw: unknown): PageDesign {
  const doc = raw as PageDesign | null | undefined
  if (doc && !Array.isArray(doc) && doc.version === 1 && Array.isArray(doc.sections)) {
    return { ...doc, styles: { ...DEFAULT_PAGE_STYLES, ...doc.styles } }
  }
  return defaultPageDesign()
}

/** Todos los bloques del documento en orden de lectura (secciones → columnas). */
export function allPageBlocks(design: PageDesign): PageBlock[] {
  return design.sections.flatMap((s) => s.columns.flat())
}

export function pageDesignIsEmpty(design: PageDesign): boolean {
  return allPageBlocks(design).length === 0
}
