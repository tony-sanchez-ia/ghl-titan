import { notFound } from 'next/navigation'
import { getFunnel, listFunnelDomains, listFunnelSteps } from '@/features/funnels/services/queries'
import { FunnelDetail } from '@/features/funnels/components/FunnelDetail'
import { DomainSettings } from '@/features/funnels/components/DomainSettings'

export default async function FunnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const funnel = await getFunnel(id)
  if (!funnel) notFound()
  const [steps, domains] = await Promise.all([listFunnelSteps(id), listFunnelDomains(id)])

  return (
    <div className="space-y-6">
      <FunnelDetail funnel={funnel} steps={steps} />
      <DomainSettings funnelId={funnel.id} domains={domains} />
    </div>
  )
}
