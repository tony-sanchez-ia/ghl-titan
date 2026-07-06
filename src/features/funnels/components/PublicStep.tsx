import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Funnel, FunnelStep } from '@/types/database'
import { getNextStep, getStepVariant } from '../services/queries'
import { migratePageDesign } from '../services/design'
import { pickVariantKey, recordPageView, VISITOR_COOKIE } from '../services/tracking'
import { PageView } from './page-render'

/**
 * Render público de un paso (RSC compartido): variante A/B sticky, registro de
 * page_view y contexto de tracking. Lo usan /p/[funnel]/[step] (dominio principal,
 * basePath '/p/slug') y /sites/[host] (dominio propio, basePath '' → URLs relativas
 * al dominio: NUNCA se construyen desde NEXT_PUBLIC_SITE_URL).
 */
export async function PublicStep({
  funnel,
  step,
  basePath,
}: {
  funnel: Funnel
  step: FunnelStep
  basePath: string
}) {
  // Visitante anónimo: cookie tv_id, o el header interno que pone proxy.ts en la 1ª visita
  const visitorId =
    (await cookies()).get(VISITOR_COOKIE)?.value ?? (await headers()).get('x-tv-id')

  // Test A/B: reparto sticky 50/50 por visitante (sin cookie → siempre A)
  const wantKey = step.ab_active && visitorId ? pickVariantKey(visitorId, step.id) : 'A'
  const variant =
    (await getStepVariant(step.id, wantKey)) ??
    (wantKey === 'B' ? await getStepVariant(step.id, 'A') : null)
  if (!variant) notFound()

  if (visitorId && visitorId.length <= 64) {
    await recordPageView({
      funnelId: funnel.id,
      stepId: step.id,
      variantId: variant.id,
      visitorId,
    })
  }

  const next = await getNextStep(funnel.id, step.position)

  return (
    <PageView
      design={migratePageDesign(variant.design)}
      mode="public"
      track={{
        stepId: step.id,
        variantId: variant.id,
        nextUrl: next ? `${basePath}/${next.slug}` : null,
      }}
    />
  )
}
