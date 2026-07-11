import { notFound } from 'next/navigation'
import { getForm, getFormAutomationLinks, listSubmissions } from '@/features/forms/services/queries'
import { getFormStats } from '@/features/forms/services/tracking'
import { listAutomations } from '@/features/automations/services/queries'
import { FormBuilder } from '@/features/forms/components/FormBuilder'

export const dynamic = 'force-dynamic'

export default async function FormEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const form = await getForm(id)
  if (!form) notFound()

  const [automations, linkedAutomationIds, submissions, stats] = await Promise.all([
    listAutomations(),
    getFormAutomationLinks(id),
    listSubmissions(id),
    getFormStats(id),
  ])

  return (
    <FormBuilder
      form={form}
      automations={automations}
      linkedAutomationIds={linkedAutomationIds}
      submissions={submissions}
      stats={stats}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ''}
    />
  )
}
