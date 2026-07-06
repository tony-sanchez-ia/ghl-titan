import { query, queryOne } from '@/lib/db'
import type { FunnelEventType } from '@/types/database'

/** Nombre de la cookie anónima de visitante (la pone proxy.ts en páginas públicas). */
export const VISITOR_COOKIE = 'tv_id'

/**
 * Reparto A/B sticky sin estado: hash determinista (djb2) de visitante+paso.
 * El mismo visitante ve SIEMPRE la misma variante de un paso, ~50/50 global.
 */
export function pickVariantKey(visitorId: string, stepId: string): 'A' | 'B' {
  const s = visitorId + stepId
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h & 1) === 0 ? 'A' : 'B'
}

/**
 * Registra una visita de página (server-side, desde el RSC público).
 * Dedupe: 1 page_view por visitante+paso+día para no inflar las vistas con recargas.
 */
export async function recordPageView(input: {
  funnelId: string
  stepId: string
  variantId: string
  visitorId: string
}): Promise<void> {
  await query(
    `insert into funnel_events (funnel_id, step_id, variant_id, visitor_id, type)
     select $1, $2, $3, $4, 'page_view'
     where not exists (
       select 1 from funnel_events
       where step_id = $2 and visitor_id = $4 and type = 'page_view'
         and created_at >= current_date
     )`,
    [input.funnelId, input.stepId, input.variantId, input.visitorId]
  )
}

/** Registra un evento de interacción (cta_click / form_submit) desde /api/track. */
export async function recordEvent(input: {
  stepId: string
  variantId: string | null
  visitorId: string
  type: Exclude<FunnelEventType, 'page_view'>
  metadata?: Record<string, unknown>
}): Promise<{ ok: boolean }> {
  const step = await queryOne<{ funnel_id: string }>(
    `select funnel_id from funnel_steps where id = $1`,
    [input.stepId]
  )
  if (!step) return { ok: false }
  await query(
    `insert into funnel_events (funnel_id, step_id, variant_id, visitor_id, type, metadata)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      step.funnel_id,
      input.stepId,
      input.variantId,
      input.visitorId,
      input.type,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
  return { ok: true }
}
