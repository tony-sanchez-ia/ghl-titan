import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getContactById } from '@/features/contacts/services/contacts'
import { ContactForm } from '@/features/contacts/components/ContactForm'

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContactById(id)
  if (!contact) notFound()

  return (
    <div className="space-y-6">
      <Link href={`/contacts/${id}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Volver a la ficha
      </Link>
      <h1 className="text-2xl font-bold">Editar contacto</h1>
      <ContactForm contact={contact} />
    </div>
  )
}
