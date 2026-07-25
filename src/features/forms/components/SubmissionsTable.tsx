import Link from 'next/link'
import { ui } from '@/shared/lib/ui'
import type { FormField, FormSubmission } from '@/types/database'
import { isInputField } from '../services/schema'

/** Etiqueta legible de una opción (evita mostrar el value interno tipo "opcion-1"). */
function optionLabel(field: FormField, value: string): string {
  return field.options?.find((o) => o.value === value)?.label ?? value
}

function formatValue(v: unknown, field: FormField): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.map((x) => optionLabel(field, String(x))).join(', ')
  if (field.type === 'select' || field.type === 'radio') return optionLabel(field, String(v))
  return String(v)
}

export function SubmissionsTable({
  submissions,
  fields,
}: {
  submissions: FormSubmission[]
  fields: FormField[]
}) {
  const cols = fields.filter((f) => isInputField(f.type))

  if (submissions.length === 0) {
    return (
      <div className={`${ui.card} p-8 text-center text-muted`}>
        Aún no hay envíos. Comparte el formulario para empezar a captar leads.
      </div>
    )
  }

  return (
    <div className={`${ui.card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-3 font-medium whitespace-nowrap">Fecha</th>
            {cols.map((c) => (
              <th key={c.id} className="px-4 py-3 font-medium whitespace-nowrap">{c.label || c.key}</th>
            ))}
            <th className="px-4 py-3 font-medium">Contacto</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 whitespace-nowrap text-muted">
                {new Date(s.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              {cols.map((c) => (
                <td key={c.id} className="px-4 py-3 max-w-xs truncate" title={formatValue(s.data[c.key], c)}>
                  {formatValue(s.data[c.key], c)}
                </td>
              ))}
              <td className="px-4 py-3">
                {s.contact_id ? (
                  <Link href={`/contacts/${s.contact_id}`} className="text-primary hover:underline">
                    Ver ficha
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
