'use client'

import { useState } from 'react'
import { Check, MailX } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { unsubscribeContact } from '@/actions/marketing'

/** Confirmación de baja en dos pasos: los escáneres de email abren links, pero no pulsan botones. */
export function UnsubscribeCard({
  token,
  email,
  alreadyUnsubscribed,
}: {
  token: string
  email: string
  alreadyUnsubscribed: boolean
}) {
  const [done, setDone] = useState(alreadyUnsubscribed)
  const [busy, setBusy] = useState(false)

  async function onConfirm() {
    setBusy(true)
    const res = await unsubscribeContact(token)
    setBusy(false)
    if (res.error) {
      alert(res.error)
      return
    }
    setDone(true)
  }

  return (
    <div className={`${ui.card} p-8 text-center space-y-4`}>
      {done ? (
        <>
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Check size={24} className="text-emerald-600 dark:text-emerald-300" />
          </div>
          <h1 className="text-xl font-bold">Te has dado de baja</h1>
          <p className="text-sm text-muted">
            {email ? <strong>{email}</strong> : 'Tu dirección'} ya no recibirá más emails de marketing.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto w-12 h-12 rounded-full bg-bg flex items-center justify-center">
            <MailX size={24} className="text-muted" />
          </div>
          <h1 className="text-xl font-bold">¿Quieres darte de baja?</h1>
          <p className="text-sm text-muted">
            {email ? <strong>{email}</strong> : 'Tu dirección'} dejará de recibir emails de marketing.
          </p>
          <button onClick={onConfirm} disabled={busy} className={`${ui.buttonPrimary} px-4 py-2.5 text-sm`}>
            Confirmar baja
          </button>
        </>
      )}
    </div>
  )
}
