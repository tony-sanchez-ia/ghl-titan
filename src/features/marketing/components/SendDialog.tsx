'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, Send, Users, X } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { countCampaignAudience, sendCampaign } from '@/actions/marketing'
import type { CampaignAudience } from '@/types/database'

/** Diálogo "Enviar o programar": audiencia con contador real + ahora o fecha/hora. */
export function SendDialog({
  campaignId,
  allTags,
  onClose,
}: {
  campaignId: string
  allTags: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const [type, setType] = useState<'all' | 'tags'>('all')
  const [tags, setTags] = useState<string[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState<'now' | 'schedule' | null>(null)

  const audience: CampaignAudience = type === 'all' ? { type: 'all' } : { type: 'tags', tags }

  useEffect(() => {
    let cancelled = false
    setCount(null)
    countCampaignAudience(type === 'all' ? { type: 'all' } : { type: 'tags', tags }).then((res) => {
      if (!cancelled && res.count !== undefined) setCount(res.count)
    })
    return () => {
      cancelled = true
    }
  }, [type, tags])

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))
  }

  async function onSend(mode: 'now' | 'schedule') {
    setBusy(mode)
    const res = await sendCampaign(campaignId, {
      audience,
      mode,
      scheduledAt: mode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    })
    setBusy(null)
    if (res.error) {
      alert(res.error)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${ui.card} w-full max-w-md p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Enviar o programar</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>

        {/* Audiencia */}
        <div className="space-y-3">
          <p className="text-sm font-medium">¿A quién se envía?</p>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="radio" checked={type === 'all'} onChange={() => setType('all')} />
            Todos los contactos con email
          </label>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="radio" checked={type === 'tags'} onChange={() => setType('tags')} />
            Solo contactos con alguna de estas etiquetas:
          </label>
          {type === 'tags' && (
            <div className="flex flex-wrap gap-1.5 pl-6">
              {allTags.length === 0 && <span className="text-sm text-muted">No hay etiquetas.</span>}
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    tags.includes(tag)
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className={`${ui.card} bg-bg p-3 text-sm inline-flex items-center gap-2 w-full`}>
            <Users size={16} className="text-muted shrink-0" />
            {count === null ? (
              <span className="text-muted">Contando destinatarios…</span>
            ) : (
              <span>
                <strong>{count}</strong> {count === 1 ? 'destinatario recibirá' : 'destinatarios recibirán'} este
                email <span className="text-muted">(se excluyen contactos sin email y bajas)</span>
              </span>
            )}
          </div>

          {count !== null && count > 100 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
              Aviso: el plan gratuito del servicio de email permite ~100 envíos al día. Con {count}{' '}
              destinatarios, parte de la campaña puede quedar en fallidos hasta mejorar el plan o
              repartir el envío.
            </p>
          )}
        </div>

        {/* Enviar ahora */}
        <div className="mt-5 space-y-4">
          <button
            onClick={() => onSend('now')}
            disabled={busy !== null || count === 0}
            className={`${ui.buttonPrimary} w-full px-4 py-2.5 text-sm`}
          >
            {busy === 'now' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar ahora
          </button>

          <div className="border-t border-border pt-4 space-y-2.5">
            <p className="text-sm font-medium inline-flex items-center gap-2">
              <CalendarClock size={16} /> O programar para más tarde
            </p>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={`${ui.input} text-sm`}
            />
            <button
              onClick={() => onSend('schedule')}
              disabled={busy !== null || !scheduledAt || count === 0}
              className={`${ui.button} w-full px-4 py-2.5 text-sm`}
            >
              {busy === 'schedule' && <Loader2 size={16} className="animate-spin" />}
              Programar envío
            </button>
            <p className="text-xs text-muted">
              Las campañas programadas dependen del proceso automático (cron), que aún está pendiente
              de configurar en el servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
