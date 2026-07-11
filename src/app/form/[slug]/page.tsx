import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getFormBySlug } from '@/features/forms/services/queries'
import { PublicFormRenderer } from '@/features/forms/components/PublicFormRenderer'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const form = await getFormBySlug(slug)
  return { title: form ? form.name : 'Formulario' }
}

/** Página pública del formulario. `?embed=1` = versión sin marco para iframe. */
export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { slug } = await params
  const { embed } = await searchParams
  const form = await getFormBySlug(slug)
  if (!form) notFound()

  const isEmbed = embed === '1'

  return (
    <main
      className="min-h-screen"
      style={{ background: isEmbed ? 'transparent' : form.styles.background_color }}
    >
      <PublicFormRenderer form={form} embed={isEmbed} />
    </main>
  )
}
