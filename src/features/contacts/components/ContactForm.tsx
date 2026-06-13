'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/shared/lib/ui'
import { createContact, updateContact } from '@/actions/contacts'
import type { Contact } from '../types'

export function ContactForm({ contact }: { contact?: Contact }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = !!contact

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = isEdit
      ? await updateContact(contact!.id, formData)
      : await createContact(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    if (isEdit) router.push(`/contacts/${contact!.id}`)
    else if ('id' in res && res.id) router.push(`/contacts/${res.id}`)
    else router.push('/contacts')
  }

  const field = (
    label: string,
    name: keyof Contact,
    type = 'text',
    defaultValue?: string | null
  ) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        className={ui.input}
      />
    </div>
  )

  return (
    <form action={handleSubmit} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Nombre', 'first_name', 'text', contact?.first_name)}
        {field('Apellidos', 'last_name', 'text', contact?.last_name)}
      </div>
      {field('Email', 'email', 'email', contact?.email)}
      {field('Teléfono', 'phone', 'tel', contact?.phone)}
      {field('Empresa', 'business_name', 'text', contact?.business_name)}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium mb-1">
          Tags <span className="text-muted font-normal">(separados por coma)</span>
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={contact?.tags?.join(', ') ?? ''}
          placeholder="cliente, seguimiento"
          className={ui.input}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className={`${ui.button} px-4 py-2.5`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
        </button>
      </div>
    </form>
  )
}
