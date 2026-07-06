import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicStep } from '@/features/funnels/services/queries'
import { PublicStep } from '@/features/funnels/components/PublicStep'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ funnel: string; step: string }>
}): Promise<Metadata> {
  const { funnel, step } = await params
  const found = await getPublicStep(funnel, step)
  if (!found) return { title: 'Página no encontrada' }
  return {
    title: found.step.seo_title || found.step.name,
    description: found.step.seo_description || undefined,
  }
}

/** Página pública de un paso del funnel en el dominio principal (/p/funnel/paso). */
export default async function PublicStepPage({
  params,
}: {
  params: Promise<{ funnel: string; step: string }>
}) {
  const { funnel, step } = await params
  const found = await getPublicStep(funnel, step)
  if (!found) notFound()

  return <PublicStep funnel={found.funnel} step={found.step} basePath={`/p/${found.funnel.slug}`} />
}
