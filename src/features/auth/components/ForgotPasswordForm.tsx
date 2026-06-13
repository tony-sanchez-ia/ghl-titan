'use client'

import { useState } from 'react'
import { resetPassword } from '@/actions/auth'
import { ui } from '@/shared/lib/ui'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await resetPassword(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <p className="text-center text-emerald-600">
        Revisa tu email: te hemos enviado un enlace para restablecer la contraseña.
      </p>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={ui.input}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className={`${ui.buttonPrimary} w-full px-4 py-2.5 disabled:opacity-50`}
      >
        {loading ? 'Enviando...' : 'Enviar enlace'}
      </button>
    </form>
  )
}
