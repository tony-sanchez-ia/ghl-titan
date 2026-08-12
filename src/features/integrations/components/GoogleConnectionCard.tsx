'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, TriangleAlert } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { disconnectGoogle } from '@/actions/integrations'

interface Connection {
  account_email: string | null
  status: 'connected' | 'reauth_required'
  connected_at: string
}

/** Mensajes para el resultado que devuelve el callback OAuth (?google=...). */
const RESULT_MESSAGES: Record<string, { kind: 'ok' | 'error'; text: string }> = {
  connected: { kind: 'ok', text: 'Google Calendar conectado.' },
  declined: { kind: 'error', text: 'Autorización cancelada en Google.' },
  state_error: { kind: 'error', text: 'El enlace caducó a mitad de proceso. Inténtalo de nuevo.' },
  error: { kind: 'error', text: 'Google no completó la conexión. Inténtalo de nuevo.' },
  config: {
    kind: 'error',
    text: 'Falta configurar la aplicación de Google (GOOGLE_CLIENT_ID/SECRET). Pídele al agente la guía de alta.',
  },
}

/**
 * Card de Ajustes → Integraciones: conexión de Google Calendar (code flow con
 * redirect — el botón navega a /api/integrations/google/start). Estados:
 * sin configurar / sin conectar / conectado / reconectar.
 */
export function GoogleConnectionCard({
  connection,
  configured,
  result,
}: {
  connection: Connection | null
  configured: boolean
  result: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 'config' sin credenciales duplicaría el mensaje estático de "falta configurar"
  const resultMsg =
    result && !(result === 'config' && !configured) ? (RESULT_MESSAGES[result] ?? null) : null

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Google? Las nuevas citas dejarán de crear eventos y enlaces de Meet.'))
      return
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await disconnectGoogle()
    setBusy(false)
    if (res.error) setError(res.error)
    else {
      setNotice('Google desconectado')
      router.refresh()
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Video className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 space-y-3">
        <div>
          <p className="font-medium text-sm">Google Calendar + Meet</p>
          {connection ? (
            <p className="text-sm text-muted">
              Conectado{connection.account_email ? ` como ${connection.account_email}` : ''}: cada
              reserva crea un evento en tu calendario (con Meet único si la cita es por videollamada).
            </p>
          ) : (
            <p className="text-sm text-muted">
              Crea un evento en tu Google Calendar por cada reserva, con enlace de Meet único en las
              citas por videollamada.
            </p>
          )}
        </div>

        {connection?.status === 'reauth_required' && (
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            La autorización caducó: vuelve a conectar tu cuenta.
          </p>
        )}

        {!configured && !connection && (
          <p className="text-sm text-muted">
            Falta configurar la aplicación de Google (GOOGLE_CLIENT_ID/SECRET). Pídele al agente la
            guía de alta.
          </p>
        )}

        {resultMsg && (
          <p className={`text-sm ${resultMsg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {resultMsg.text}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}

        <div className="flex gap-2">
          {connection ? (
            <>
              {connection.status === 'reauth_required' && (
                <a
                  href="/api/integrations/google/start"
                  className={`${ui.buttonPrimary} px-4 py-2 text-sm inline-block`}
                >
                  Reconectar
                </a>
              )}
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className={`${ui.button} px-4 py-2 text-sm disabled:opacity-50`}
              >
                Desconectar
              </button>
            </>
          ) : configured ? (
            <a
              href="/api/integrations/google/start"
              className={`${ui.buttonPrimary} px-4 py-2 text-sm inline-block`}
            >
              Conectar con Google
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
