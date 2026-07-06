import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getWorkflowForEdit, listForms } from '@/features/automations/services/queries'
import { listCalendars } from '@/features/scheduling/services/calendars'
import { WorkflowBuilder } from '@/features/automations/components/WorkflowBuilder'

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [workflow, forms, calendars] = await Promise.all([
    getWorkflowForEdit(id),
    listForms(),
    listCalendars(),
  ])
  if (!workflow) notFound()

  return (
    <div className="space-y-6">
      <Link href="/automations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Automatizaciones
      </Link>
      <WorkflowBuilder workflow={workflow} forms={forms} calendars={calendars} />
    </div>
  )
}
