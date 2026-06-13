import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormEditor } from '@/features/automations/components/FormEditor'

export default function NewFormPage() {
  return (
    <div className="space-y-6">
      <Link href="/automations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Automatizaciones
      </Link>
      <h1 className="text-2xl font-bold">Nuevo formulario</h1>
      <FormEditor />
    </div>
  )
}
