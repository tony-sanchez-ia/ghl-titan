import type { SectionLayout } from '@/types/database'

/**
 * Anchos de columna (en %) por layout de sección.
 * Compartido por el editor de emails (PRP-008) y el editor de páginas de funnels (PRP-009).
 */
export const LAYOUT_COLUMNS: Record<SectionLayout, number[]> = {
  '1': [100],
  '2': [50, 50],
  '3': [33.33, 33.33, 33.34],
  '4': [25, 25, 25, 25],
  '1/3:2/3': [33.33, 66.67],
  '2/3:1/3': [66.67, 33.33],
  '1/4:3/4': [25, 75],
  '3/4:1/4': [75, 25],
}

export function columnCount(layout: SectionLayout): number {
  return LAYOUT_COLUMNS[layout].length
}
