import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil, Mail, Phone, Building2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { getContactById, getContactRelated } from '@/features/contacts/services/contacts'
import { TagChip } from '@/features/contacts/components/TagChip'
import { ActivityTimeline } from '@/features/contacts/components/ActivityTimeline'
import { ContactRelated } from '@/features/contacts/components/ContactRelated'
import { DeleteContactButton } from '@/features/contacts/components/DeleteContactButton'

function fullName(c: { first_name: string | null; last_name: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sin nombre'
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContactById(id)
  if (!contact) notFound()
  const related = await getContactRelated(id)

  const row = (Icon: typeof Mail, label: string, value: string | null) => (
    <div className="flex items-center gap-3 py-2">
      <Icon size={16} className="text-muted shrink-0" />
      <span className="text-muted w-20 shrink-0">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Contactos
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{fullName(contact)}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${contact.id}/edit`} className={`${ui.button} px-3 py-2 text-sm`}>
            <Pencil size={16} /> Editar
          </Link>
          <DeleteContactButton id={contact.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${ui.card} p-5 lg:col-span-1`}>
          <h2 className="font-semibold mb-2">Datos</h2>
          <div className="divide-y divide-border text-sm">
            {row(Mail, 'Email', contact.email)}
            {row(Phone, 'Teléfono', contact.phone)}
            {row(Building2, 'Empresa', contact.business_name)}
          </div>
          {contact.tags.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <TagChip key={t} tag={t} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${ui.card} p-5 lg:col-span-2`}>
          <h2 className="font-semibold mb-4">Actividad</h2>
          <ActivityTimeline activities={contact.activities} />
        </div>
      </div>

      <ContactRelated related={related} />
    </div>
  )
}
