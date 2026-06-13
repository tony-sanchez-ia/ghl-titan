import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicFormBySlug } from '@/features/automations/services/queries'
import { PublicForm } from '@/features/automations/components/PublicForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const form = await getPublicFormBySlug(slug)
  return { title: form ? form.name : 'Formulario' }
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const form = await getPublicFormBySlug(slug)
  if (!form) notFound()

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="w-full">
        <PublicForm slug={form.slug} name={form.name} description={form.description} />
        <p className="text-center text-xs text-muted mt-6">Powered by GHL Titan</p>
      </div>
    </div>
  )
}
