'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { submitPublicForm } from '@/actions/automations'

/**
 * Formulario embebido en una página de funnel: mismo flujo que /form/[slug]
 * (contacto al CRM + automatizaciones) + evento form_submit + salto al paso siguiente.
 * Estilos neutros con el color de botón de la página (no usa tokens del panel).
 */
export function EmbeddedFunnelForm({
  formSlug,
  stepId,
  variantId,
  nextUrl,
  buttonColor,
  buttonLabel,
}: {
  formSlug: string
  stepId: string
  variantId: string
  nextUrl: string | null
  buttonColor: string
  buttonLabel: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('slug', formSlug)
    const res = await submitPublicForm(formData)
    if (res?.error) {
      setLoading(false)
      setError(res.error)
      return
    }
    try {
      await fetch('/api/track', {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, variant_id: variantId, type: 'form_submit', metadata: { form_slug: formSlug } }),
        keepalive: true,
      })
    } catch {
      /* el tracking jamás rompe el envío */
    }
    if (nextUrl) {
      router.push(nextUrl)
      return
    }
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/70 p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
        <p className="mt-3 font-semibold">¡Gracias! Hemos recibido tus datos.</p>
      </div>
    )
  }

  const input =
    'block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400'

  return (
    <form action={handleSubmit} className="mx-auto max-w-md space-y-3 text-left">
      <input name="name" required placeholder="Tu nombre" className={input} />
      <input name="email" type="email" required placeholder="Tu email" className={input} />
      <input name="phone" type="tel" placeholder="Tu teléfono (opcional)" className={input} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg px-8 py-3.5 text-base md:text-lg font-semibold text-white shadow-sm disabled:opacity-60"
        style={{ background: buttonColor }}
      >
        {loading ? 'Enviando…' : buttonLabel}
      </button>
    </form>
  )
}
