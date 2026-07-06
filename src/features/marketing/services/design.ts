import { uid } from '@/shared/lib/uid'
import type {
  EmailBlock,
  EmailDesign,
  EmailSection,
  SectionLayout,
  SocialNetwork,
  StoredEmailDesign,
} from '@/types/database'

export const DEFAULT_STYLES = {
  background_color: '#f1f5f9', // los valores V1 hardcodeados: los diseños migrados no cambian de aspecto
  button_color: '#2563eb',
} as const

export const DEFAULT_SECTION_PADDING = 8

// Layouts de columnas: movidos a shared (los comparte el editor de páginas de funnels)
import { LAYOUT_COLUMNS, columnCount } from '@/shared/lib/section-layout'
export { LAYOUT_COLUMNS, columnCount }

export function newSection(layout: SectionLayout, blocks: EmailBlock[] = []): EmailSection {
  return {
    id: uid(),
    layout,
    config: {},
    columns: LAYOUT_COLUMNS[layout].map((_, i) => (i === 0 ? blocks : [])),
  }
}

function isV2(raw: StoredEmailDesign): raw is EmailDesign {
  return !Array.isArray(raw) && raw?.version === 2
}

/**
 * Migración perezosa V1 → V2: un array plano de bloques pasa a ser un documento
 * con UNA sección de 1 columna y los estilos por defecto (aspecto idéntico).
 * Nunca muta lo guardado: se aplica en memoria en cada punto de lectura.
 */
export function migrateDesign(raw: StoredEmailDesign | null | undefined): EmailDesign {
  if (raw && isV2(raw)) return raw
  const blocks = Array.isArray(raw) ? raw : []
  return {
    version: 2,
    styles: { ...DEFAULT_STYLES },
    sections: blocks.length > 0 ? [{ ...newSection('1', blocks), id: 'sec-legacy' }] : [],
  }
}

/** Todos los bloques del documento en orden de lectura (secciones → columnas). */
export function allBlocks(design: EmailDesign): EmailBlock[] {
  return design.sections.flatMap((s) => s.columns.flat())
}

export function designIsEmpty(design: EmailDesign): boolean {
  return allBlocks(design).length === 0
}

/** Redes soportadas por el bloque Redes sociales (icono en public/email/social/<red>.png). */
export const SOCIAL_NETWORKS: { network: SocialNetwork; label: string }[] = [
  { network: 'instagram', label: 'Instagram' },
  { network: 'facebook', label: 'Facebook' },
  { network: 'youtube', label: 'YouTube' },
  { network: 'x', label: 'X (Twitter)' },
  { network: 'linkedin', label: 'LinkedIn' },
  { network: 'tiktok', label: 'TikTok' },
  { network: 'whatsapp', label: 'WhatsApp' },
]

/** Miniatura automática de YouTube a partir de la URL del vídeo (null si no es YouTube). */
export function youtubeThumbnail(videoUrl: string): string | null {
  const m = videoUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/
  )
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

/** Diseño inicial de una campaña nueva (equivalente al default V1). */
export function defaultDesign(): EmailDesign {
  return {
    version: 2,
    styles: { ...DEFAULT_STYLES },
    sections: [
      newSection('1', [
        { id: 'b-header', type: 'header', config: { title: 'GHL Titan' } },
        {
          id: 'b-text',
          type: 'text',
          config: { text: 'Hola {{nombre}},\n\nEscribe aquí tu mensaje.', size: 'normal', align: 'left' },
        },
        { id: 'b-footer', type: 'footer', config: { footer_text: 'GHL Titan · Titanic Factory' } },
      ]),
    ],
  }
}
