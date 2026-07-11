'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, ExternalLink, Loader2, TriangleAlert } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  startOutlookLink,
  pollOutlookLink,
  getOutlookCalendars,
  chooseOutlookCalendar,
  disconnectOutlook,
} from '@/actions/integrations'

interface Connection {
  account_email: string | null
  calendar_id: string | null
  calendar_name: string | null
  status: 'connected' | 'reauth_required'
  connected_at: string
}

interface LinkInfo {
  userCode: string
  verificationUri: string
  interval: number
}

/**
 * Card de Ajustes → Integraciones: enlace de Outlook por código de dispositivo.
 * Estados: no conectado / enlazando (código + polling) / conectado (+ selector
 * de calendario) / reconectar.
 */
export function OutlookConnectionCard({ connection }: { connection: Connection | null }) {
  const router = useRouter()
  const [link, setLink] = useState<LinkInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selector de calendario (solo conectado)
  const [calendars, setCalendars] = useState<{ id: string; name: string }[] | null>(null)
  const [savingCal, setSavingCal] = useState(false)

  function stopPolling() {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = null
  }

  useEffect(() => stopPolling, [])

  async function handleConnect() {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await startOutlookLink()
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setLink(res)
    schedulePoll(res.interval)
  }

  function schedulePoll(seconds: number) {
    stopPolling()
    pollTimer.current = setTimeout(async () => {
      const res = await pollOutlookLink()
      if (res.status === 'pending') return schedulePoll(seconds)
      if (res.status === 'slow_down') return schedulePoll(seconds + 5)

      setLink(null)
      if (res.status === 'connected') {
        setNotice(`Outlook conectado${res.email ? ` como ${res.email}` : ''}`)
        router.refresh()
      } else if (res.status === 'expired') {
        setError('El código caducó. Genera uno nuevo.')
      } else if (res.status === 'declined') {
        setError('Autorización rechazada en Microsoft.')
      } else {
        setError(res.error ?? 'Error al conectar con Microsoft')
      }
    }, seconds * 1000)
  }

  function handleCancelLink() {
    stopPolling()
    setLink(null)
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Outlook? La agenda dejará de consultar tu calendario.')) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await disconnectOutlook()
    setBusy(false)
    if (res.error) setError(res.error)
    else {
      setCalendars(null)
      setNotice('Outlook desconectado')
      router.refresh()
    }
  }

  // Carga la lista de calendarios al estar conectado (para el selector)
  const isConnected = connection?.status === 'connected'
  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    getOutlookCalendars().then((res) => {
      if (!cancelled && 'calendars' in res) setCalendars(res.calendars)
    })
    return () => {
      cancelled = true
    }
  }, [isConnected])

  async function handleCalendarChange(id: string) {
    const cal = calendars?.find((c) => c.id === id)
    if (!cal) return
    setSavingCal(true)
    setError(null)
    const res = await chooseOutlookCalendar(cal.id, cal.name)
    setSavingCal(false)
    if (res.error) setError(res.error)
    else {
      setNotice(`Se consultará «${cal.name}»`)
      router.refresh()
    }
  }

  return (
    <div className={`${ui.card} p-5 space-y-4 max-w-lg`}>
      <div>
        <h2 className="font-semibold">Integraciones</h2>
        <p className="text-sm text-muted mt-0.5">
          Calendario externo que se consulta antes de ofrecer huecos de reserva.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <CalendarCheck2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium text-sm">Calendario de Outlook</p>
            {connection ? (
              <p className="text-sm text-muted">
                Conectado{connection.account_email ? ` como ${connection.account_email}` : ''}
              </p>
            ) : (
              <p className="text-sm text-muted">
                Solo lectura: los eventos ocupados bloquean huecos en tu página de reservas.
              </p>
            )}
          </div>

          {/* Aviso de reconexión */}
          {connection?.status === 'reauth_required' && (
            <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              La autorización caducó: vuelve a conectar tu cuenta.
            </p>
          )}

          {/* Enlazando: código + instrucciones + polling */}
          {link && (
            <div className="rounded-lg border border-border bg-bg p-4 space-y-3">
              <p className="text-sm">
                1. Abre{' '}
                <a
                  href={link.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium inline-flex items-center gap-1 hover:underline"
                >
                  {link.verificationUri.replace('https://', '')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>{' '}
                en cualquier navegador
              </p>
              <p className="text-sm">2. Introduce este código y acepta con tu cuenta Microsoft:</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-center select-all">
                {link.userCode}
              </p>
              <p className="flex items-center justify-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Esperando autorización…
              </p>
              <button onClick={handleCancelLink} className={`${ui.button} w-full px-4 py-2 text-sm`}>
                Cancelar
              </button>
            </div>
          )}

          {/* Selector de calendario (conectado) */}
          {isConnected && !link && (
            <div>
              <label htmlFor="outlook-calendar" className="block text-sm font-medium mb-1">
                Calendario que se consulta
              </label>
              {calendars ? (
                <select
                  id="outlook-calendar"
                  value={connection?.calendar_id ?? ''}
                  onChange={(e) => handleCalendarChange(e.target.value)}
                  disabled={savingCal}
                  className={`${ui.input} disabled:opacity-50`}
                >
                  {!connection?.calendar_id && <option value="">Predeterminado</option>}
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted">
                  {connection?.calendar_name ?? 'Predeterminado'}
                  <span className="ml-2 opacity-70">(cargando lista…)</span>
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}

          {/* Acciones */}
          {!link && (
            <div className="flex gap-2">
              {connection ? (
                <>
                  {connection.status === 'reauth_required' && (
                    <button
                      onClick={handleConnect}
                      disabled={busy}
                      className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}
                    >
                      {busy ? 'Conectando…' : 'Reconectar'}
                    </button>
                  )}
                  <button
                    onClick={handleDisconnect}
                    disabled={busy}
                    className={`${ui.button} px-4 py-2 text-sm disabled:opacity-50`}
                  >
                    Desconectar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={busy}
                  className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}
                >
                  {busy ? 'Conectando…' : 'Conectar Outlook'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
