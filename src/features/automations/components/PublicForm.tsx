'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { submitPublicForm } from '@/actions/automations'

export function PublicForm({
  slug,
  name,
  description,
}: {
  slug: string
  name: string
  description: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('slug', slug)
    const res = await submitPublicForm(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className={`${ui.card} max-w-md mx-auto p-8 text-center`}>
        <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
        <h2 className="text-xl font-bold mt-4">¡Gracias!</h2>
        <p className="text-muted mt-2">Hemos recibido tus datos. Te escribiremos muy pronto.</p>
      </div>
    )
  }

  return (
    <div className={`${ui.card} max-w-md mx-auto p-8`}>
      <h1 className="text-2xl font-bold">{name}</h1>
      {description && <p className="text-muted mt-2 text-sm whitespace-pre-line">{description}</p>}
      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre</label>
          <input id="name" name="name" required className={ui.input} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input id="email" name="email" type="email" required className={ui.input} />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">Teléfono <span className="text-muted font-normal">(opcional)</span></label>
          <input id="phone" name="phone" type="tel" className={ui.input} />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-1">Mensaje <span className="text-muted font-normal">(opcional)</span></label>
          <textarea id="message" name="message" rows={3} className={ui.input} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={`${ui.buttonPrimary} w-full px-4 py-2.5 disabled:opacity-50`}>
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
