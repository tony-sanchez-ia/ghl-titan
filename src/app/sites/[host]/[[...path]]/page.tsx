import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getFirstStep,
  getFunnelByHostname,
  getStepBySlug,
} from '@/features/funnels/services/queries'
import { PublicStep } from '@/features/funnels/components/PublicStep'
import type { Funnel, FunnelStep } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Destino del rewrite multidominio de proxy.ts: sirve el funnel asociado al
 * dominio desde su raíz (`/` = primer paso, `/slug` = paso concreto).
 * Las URLs generadas son RELATIVAS al dominio (nunca NEXT_PUBLIC_SITE_URL).
 */
async function resolve(
  host: string,
  path: string[] | undefined
): Promise<{ funnel: Funnel; step: FunnelStep } | null> {
  const funnel = await getFunnelByHostname(host)
  if (!funnel) return null
  const step =
    path && path.length > 0
      ? await getStepBySlug(funnel.id, path[0])
      : await getFirstStep(funnel.id)
  if (!step) return null
  return { funnel, step }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; path?: string[] }>
}): Promise<Metadata> {
  const { host, path } = await params
  const found = await resolve(host, path)
  if (!found) return { title: 'Página no encontrada' }
  return {
    title: found.step.seo_title || found.step.name,
    description: found.step.seo_description || undefined,
  }
}

export default async function CustomDomainPage({
  params,
}: {
  params: Promise<{ host: string; path?: string[] }>
}) {
  const { host, path } = await params
  const found = await resolve(host, path)
  if (!found) notFound()

  return <PublicStep funnel={found.funnel} step={found.step} basePath="" />
}
