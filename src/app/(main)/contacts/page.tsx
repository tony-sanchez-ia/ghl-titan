import Link from 'next/link'
import { ui } from '@/shared/lib/ui'
import { listContacts, listAllTags } from '@/features/contacts/services/contacts'
import { ContactsHeader } from '@/features/contacts/components/ContactsHeader'
import { TagChip } from '@/features/contacts/components/TagChip'

function fullName(c: { first_name: string | null; last_name: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sin nombre'
}

function initials(c: { first_name: string | null; last_name: string | null }) {
  const a = c.first_name?.[0] ?? ''
  const b = c.last_name?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>
}) {
  const { q, tag } = await searchParams
  const [contacts, tags] = await Promise.all([
    listContacts({ search: q, tag }),
    listAllTags(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contactos</h1>
        <p className="mt-1 text-muted">{contacts.length} contactos</p>
      </div>

      <ContactsHeader tags={tags} />

      <div className={`${ui.card} overflow-hidden`}>
        {contacts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted">No hay contactos.</p>
            <p className="text-sm text-muted mt-1">
              Importa tu CSV de GoHighLevel o crea uno nuevo.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Teléfono</th>
                <th className="px-4 py-3 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-xs font-semibold">
                        {initials(c)}
                      </span>
                      {fullName(c)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted hidden lg:table-cell">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <TagChip key={t} tag={t} />
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-xs text-muted">+{c.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
