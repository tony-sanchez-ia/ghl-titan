'use client'

import { useState } from 'react'
import { ui } from '@/shared/lib/ui'
import { updateProfile } from '@/actions/auth'

export function ProfileForm({ fullName, email }: { fullName: string | null; email: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMsg(null)
    setError(null)
    const res = await updateProfile(formData)
    setLoading(false)
    if (res?.error) setError(res.error)
    else setMsg('Perfil actualizado')
  }

  return (
    <form action={handleSubmit} className={`${ui.card} p-5 space-y-4 max-w-lg`}>
      <h2 className="font-semibold">Perfil</h2>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input value={email} disabled className={`${ui.input} opacity-60`} />
      </div>
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium mb-1">Nombre</label>
        <input id="full_name" name="full_name" defaultValue={fullName ?? ''} className={ui.input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
