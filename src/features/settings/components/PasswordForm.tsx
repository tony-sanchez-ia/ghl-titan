'use client'

import { useState, useRef } from 'react'
import { ui } from '@/shared/lib/ui'
import { changePassword } from '@/actions/auth'

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMsg(null)
    setError(null)
    const res = await changePassword(formData)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setMsg('Contraseña actualizada')
      formRef.current?.reset()
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className={`${ui.card} p-5 space-y-4 max-w-lg`}>
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">Nueva contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required className={ui.input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
        {loading ? 'Guardando...' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
