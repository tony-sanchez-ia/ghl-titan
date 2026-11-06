export const MODULE_KEYS = ['courses', 'funnels', 'websites', 'forms'] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export type InstanceSettings = {
  brandName: string | null
  accentColor: string | null
  /** Versión del logo (ms) para invalidar caché; null si no hay logo. */
  logoVersion: number | null
  modules: Record<ModuleKey, boolean>
}
