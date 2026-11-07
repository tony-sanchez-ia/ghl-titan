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
  modules: { calendars: true, courses: true, funnels: true, websites: true, forms: true },
}

/** Fila leída como JSON: una columna nueva que aún no exista (deploy antes de migrar) llega undefined. */
type Row = Partial<{
  brand_name: string | null
  accent_color: string | null
  logo_updated_at: string | null
  module_calendars: boolean
  module_courses: boolean
  module_funnels: boolean
  module_websites: boolean
  module_forms: boolean
}>

/**
 * Ajustes de la instancia (una query por request gracias a cache()).
 * NUNCA lee logo_data: los bytes solo los sirve /api/brand/logo.
 * Tolerante a migraciones pendientes: tabla ausente → defaults; columna ausente → módulo ON.
 */
export const getInstanceSettings = cache(async (): Promise<InstanceSettings> => {
  let row: Row | null
  try {
    const res = await queryOne<{ j: Row }>(
      `select to_jsonb(s) - 'logo_data' as j from instance_settings s where id = true`
    )
    row = res?.j ?? null
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return DEFAULTS
    throw err
  }
  if (!row) return DEFAULTS
  return {
    brandName: row.brand_name ?? null,
    accentColor: row.accent_color ?? null,
    logoVersion: row.logo_updated_at ? new Date(row.logo_updated_at).getTime() : null,
    modules: {
      calendars: row.module_calendars ?? true,
      courses: row.module_courses ?? true,
      funnels: row.module_funnels ?? true,
      websites: row.module_websites ?? true,
      forms: row.module_forms ?? true,
    },
  }
})

/** En layouts de sección del panel: si el módulo está apagado → al Inicio. */
export async function requireModule(key: ModuleKey): Promise<void> {
  const { modules } = await getInstanceSettings()
  if (!modules[key]) redirect('/dashboard')
}
