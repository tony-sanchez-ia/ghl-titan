'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/shared/lib/ui'
import { createAutomation } from '@/actions/automations'

export function NewAutomationForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await createAutomation(formData)
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    if ('id' in res && res.id) router.push(`/automations/${res.id}`)
  }

  return (
    <form action={handleSubmit} className={`${ui.card} p-5 space-y-4 max-w-lg`}>
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre de la secuencia</label>
        <input id="name" name="name" required className={ui.input} placeholder="Bienvenida de leads" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className={`${ui.button} px-4 py-2.5`}>Cancelar</button>
        <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
          {loading ? 'Creando...' : 'Crear secuencia'}
        </button>
      </div>
    </form>
  )
}
