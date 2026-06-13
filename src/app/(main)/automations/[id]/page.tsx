import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAutomationForEdit, listForms } from '@/features/automations/services/queries'
import { AutomationEditor } from '@/features/automations/components/AutomationEditor'

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [automation, forms] = await Promise.all([getAutomationForEdit(id), listForms()])
  if (!automation) notFound()

  return (
    <div className="space-y-6">
      <Link href="/automations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Automatizaciones
      </Link>
      <AutomationEditor automation={automation} forms={forms} />
    </div>
  )
}
