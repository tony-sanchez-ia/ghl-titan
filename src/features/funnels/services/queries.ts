import { query, queryOne } from '@/lib/db'
import type { Funnel, FunnelDomain, FunnelStep, FunnelStepVariant } from '@/types/database'

export interface FunnelListItem {
  id: string
  name: string
  slug: string
  status: Funnel['status']
  updated_at: string
  steps: number
  domains: number
}

export async function listFunnels(): Promise<FunnelListItem[]> {
  return query<FunnelListItem>(
    `select f.id, f.name, f.slug, f.status, f.updated_at,
            count(distinct s.id)::int as steps,
            count(distinct d.id)::int as domains
     from funnels f
     left join funnel_steps s on s.funnel_id = f.id
     left join funnel_domains d on d.funnel_id = f.id
     group by f.id
     order by f.updated_at desc`
  )
}

export async function getFunnel(id: string): Promise<Funnel | null> {
  return queryOne<Funnel>(`select * from funnels where id = $1`, [id])
}

export async function listFunnelSteps(funnelId: string): Promise<FunnelStep[]> {
  return query<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 order by position, created_at`,
    [funnelId]
  )
}

/** Variantes de un paso ('A' primero). Sin test A/B activo solo existe la 'A'. */
export async function listStepVariants(stepId: string): Promise<FunnelStepVariant[]> {
  return query<FunnelStepVariant>(
    `select * from funnel_step_variants where step_id = $1 order by variant_key`,
    [stepId]
  )
}

export async function getFunnelStep(stepId: string): Promise<FunnelStep | null> {
  return queryOne<FunnelStep>(`select * from funnel_steps where id = $1`, [stepId])
}

export async function getStepVariant(
  stepId: string,
  key: 'A' | 'B'
): Promise<FunnelStepVariant | null> {
  return queryOne<FunnelStepVariant>(
    `select * from funnel_step_variants where step_id = $1 and variant_key = $2`,
    [stepId, key]
  )
}

/** Paso público por slugs (solo funnels publicados). */
export async function getPublicStep(
  funnelSlug: string,
  stepSlug: string
): Promise<{ funnel: Funnel; step: FunnelStep } | null> {
  const funnel = await queryOne<Funnel>(
    `select * from funnels where slug = $1 and status = 'published'`,
    [funnelSlug]
  )
  if (!funnel) return null
  const step = await queryOne<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 and slug = $2`,
    [funnel.id, stepSlug]
  )
  if (!step) return null
  return { funnel, step }
}

// ─── Dominios propios ────────────────────────────────────────────────────────

export async function listFunnelDomains(funnelId: string): Promise<FunnelDomain[]> {
  return query<FunnelDomain>(
    `select * from funnel_domains where funnel_id = $1 order by created_at`,
    [funnelId]
  )
}

/** Funnel publicado asociado a un dominio propio (para /sites/[host]). */
export async function getFunnelByHostname(hostname: string): Promise<Funnel | null> {
  return queryOne<Funnel>(
    `select f.* from funnels f
     join funnel_domains d on d.funnel_id = f.id
     where d.hostname = $1 and f.status = 'published'`,
    [hostname.toLowerCase()]
  )
}

/** Paso de un funnel por slug (para dominios propios). */
export async function getStepBySlug(funnelId: string, stepSlug: string): Promise<FunnelStep | null> {
  return queryOne<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 and slug = $2`,
    [funnelId, stepSlug]
  )
}

/** Primer paso de un funnel (por posición). */
export async function getFirstStep(funnelId: string): Promise<FunnelStep | null> {
  return queryOne<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 order by position, created_at limit 1`,
    [funnelId]
  )
}

export interface AbVariantStats {
  variant_key: 'A' | 'B'
  visitors: number
  clickers: number
  conversions: number
}

/** Métricas por variante de un paso (visitantes únicos, clicks CTA y envíos de formulario). */
export async function getAbStats(stepId: string, days: number | null = null): Promise<AbVariantStats[]> {
  return query<AbVariantStats>(
    `select v.variant_key,
            count(distinct e.visitor_id) filter (where e.type = 'page_view')::int as visitors,
            count(distinct e.visitor_id) filter (where e.type = 'cta_click')::int as clickers,
            count(distinct e.visitor_id) filter (where e.type = 'form_submit')::int as conversions
     from funnel_step_variants v
     left join funnel_events e on e.variant_id = v.id
       and ($2::int is null or e.created_at >= now() - make_interval(days => $2::int))
     where v.step_id = $1
     group by v.variant_key
     order by v.variant_key`,
    [stepId, days]
  )
}

export interface FunnelStepStats {
  step_id: string
  name: string
  position: number
  ab_active: boolean
  visitors: number
  views: number
  clickers: number
  conversions: number
}

/** Métricas del embudo por paso, opcionalmente limitadas a los últimos N días. */
export async function getFunnelStats(
  funnelId: string,
  days: number | null = null
): Promise<FunnelStepStats[]> {
  return query<FunnelStepStats>(
    `select s.id as step_id, s.name, s.position, s.ab_active,
            count(distinct e.visitor_id) filter (where e.type = 'page_view')::int as visitors,
            count(e.id) filter (where e.type = 'page_view')::int as views,
            count(distinct e.visitor_id) filter (where e.type = 'cta_click')::int as clickers,
            count(distinct e.visitor_id) filter (where e.type = 'form_submit')::int as conversions
     from funnel_steps s
     left join funnel_events e on e.step_id = s.id
       and ($2::int is null or e.created_at >= now() - make_interval(days => $2::int))
     where s.funnel_id = $1
     group by s.id
     order by s.position, s.created_at`,
    [funnelId, days]
  )
}

/** Paso siguiente del funnel (por posición), o null si es el último. */
export async function getNextStep(funnelId: string, position: number): Promise<FunnelStep | null> {
  return queryOne<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 and position > $2 order by position, created_at limit 1`,
    [funnelId, position]
  )
}

/** Primer paso de un funnel publicado (para la raíz /p/[funnel] y dominios propios). */
export async function getPublicFirstStep(funnelSlug: string): Promise<{
  funnel: Funnel
  step: FunnelStep
} | null> {
  const funnel = await queryOne<Funnel>(
    `select * from funnels where slug = $1 and status = 'published'`,
    [funnelSlug]
  )
  if (!funnel) return null
  const step = await queryOne<FunnelStep>(
    `select * from funnel_steps where funnel_id = $1 order by position, created_at limit 1`,
    [funnel.id]
  )
  if (!step) return null
  return { funnel, step }
}
