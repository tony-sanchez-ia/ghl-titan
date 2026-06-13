import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getFormById } from '@/features/automations/services/queries'
import { FormEditor } from '@/features/automations/components/FormEditor'

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const form = await getFormById(id)
  if (!form) notFound()

  return (
    <div className="space-y-6">
      <Link href="/automations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Automatizaciones
      </Link>
      <h1 className="text-2xl font-bold">{form.name}</h1>
      <FormEditor form={form} />
    </div>
  )
}
