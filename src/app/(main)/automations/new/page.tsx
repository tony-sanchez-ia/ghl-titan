import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NewAutomationForm } from '@/features/automations/components/NewAutomationForm'

export default function NewAutomationPage() {
  return (
    <div className="space-y-6">
      <Link href="/automations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Automatizaciones
      </Link>
      <h1 className="text-2xl font-bold">Nueva secuencia</h1>
      <NewAutomationForm />
    </div>
  )
}
