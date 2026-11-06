import { cache } from 'react'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import type { InstanceSettings, ModuleKey } from '../types'

/** Nombre por defecto de la plataforma cuando la instancia no tiene marca. */
export const DEFAULT_BRAND_NAME = 'GHL Titan'

const DEFAULTS: InstanceSettings = {
  brandName: null,
  accentColor: null,
  logoVersion: null,
  modules: { courses: true, funnels: true, websites: true, forms: true },
}

type Row = {
  brand_name: string | null
  accent_color: string | null
  logo_updated_at: Date | null
  module_courses: boolean
  module_funnels: boolean
  module_websites: boolean
  module_forms: boolean
}

/**
 * Ajustes de la instancia (una query por request gracias a cache()).
 * NUNCA lee logo_data: los bytes solo los sirve /api/brand/logo.
 * Si la tabla aún no existe (deploy antes de migrar) → defaults: todo ON, sin marca.
 */
export const getInstanceSettings = cache(async (): Promise<InstanceSettings> => {
  let row: Row | null
  try {
    row = await queryOne<Row>(
      `select brand_name, accent_color, logo_updated_at,
              module_courses, module_funnels, module_websites, module_forms
         from instance_settings where id = true`
    )
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return DEFAULTS
    throw err
  }
  if (!row) return DEFAULTS
  return {
    brandName: row.brand_name,
    accentColor: row.accent_color,
    logoVersion: row.logo_updated_at ? row.logo_updated_at.getTime() : null,
    modules: {
      courses: row.module_courses,
      funnels: row.module_funnels,
      websites: row.module_websites,
      forms: row.module_forms,
    },
  }
})

/** En layouts de sección del panel: si el módulo está apagado → al Inicio. */
export async function requireModule(key: ModuleKey): Promise<void> {
  const { modules } = await getInstanceSettings()
  if (!modules[key]) redirect('/dashboard')
}
