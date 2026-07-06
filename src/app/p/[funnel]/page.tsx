import { notFound, redirect } from 'next/navigation'
import { getPublicFirstStep } from '@/features/funnels/services/queries'

export const dynamic = 'force-dynamic'

/** Raíz del funnel: manda al primer paso. */
export default async function FunnelRootPage({
  params,
}: {
  params: Promise<{ funnel: string }>
}) {
  const { funnel } = await params
  const found = await getPublicFirstStep(funnel)
  if (!found) notFound()
  redirect(`/p/${found.funnel.slug}/${found.step.slug}`)
}
