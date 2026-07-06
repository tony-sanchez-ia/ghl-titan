import { notFound } from 'next/navigation'
import { aiAvailable } from '@/lib/ai/openrouter'
import { listForms } from '@/features/automations/services/queries'
import { getAbStats, getFunnel, getFunnelStep, getStepVariant } from '@/features/funnels/services/queries'
import { PageBuilder } from '@/features/funnels/components/PageBuilder'

export default async function StepEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; stepId: string }>
  searchParams: Promise<{ variant?: string }>
}) {
  const { id, stepId } = await params
  const { variant: variantParam } = await searchParams
  const [funnel, step, forms] = await Promise.all([getFunnel(id), getFunnelStep(stepId), listForms()])
  if (!funnel || !step || step.funnel_id !== funnel.id) notFound()

  const wantKey = step.ab_active && variantParam === 'B' ? 'B' : 'A'
  const variant = await getStepVariant(step.id, wantKey)
  if (!variant) notFound()

  const abStats = step.ab_active ? await getAbStats(step.id) : null

  return (
    <PageBuilder
      key={variant.id} // remonta el editor al cambiar de variante (estado del diseño)
      funnel={funnel}
      step={step}
      variant={variant}
      forms={forms}
      aiEnabled={aiAvailable()}
      abStats={abStats}
    />
  )
}
