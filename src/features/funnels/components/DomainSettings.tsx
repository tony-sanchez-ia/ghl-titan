'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Plus, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { addFunnelDomain, removeFunnelDomain } from '@/actions/funnels'
import type { FunnelDomain } from '@/types/database'

/** Dominios propios del funnel (el alta DNS + EasyPanel es manual: ver instrucciones). */
export function DomainSettings({
  funnelId,
  domains,
}: {
  funnelId: string
  domains: FunnelDomain[]
}) {
  const router = useRouter()
  const [hostname, setHostname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onAdd() {
    setBusy(true)
    setError(null)
    const res = await addFunnelDomain(funnelId, hostname)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setHostname('')
    router.refresh()
  }

  return (
    <div className={`${ui.card} divide-y divide-border`}>
      <div className="px-5 py-4">
        <h2 className="font-semibold inline-flex items-center gap-2">
          <Globe size={16} className="text-primary" /> Dominios propios
        </h2>
        <p className="text-sm text-muted mt-0.5">
          Sirve este embudo desde el dominio de tu cliente, con su raíz en el primer paso.
        </p>
      </div>

      {domains.map((d) => (
        <div key={d.id} className="px-5 py-3 flex items-center gap-3">
          <span className="flex-1 font-mono text-sm truncate">{d.hostname}</span>
          <a
            href={`https://${d.hostname}`}
            target="_blank"
            className="text-xs text-primary hover:underline shrink-0"
          >
            Abrir
          </a>
          <button
            onClick={async () => {
              if (!confirm(`¿Quitar el dominio ${d.hostname}?`)) return
              await removeFunnelDomain(d.id)
              router.refresh()
            }}
            className="p-1.5 text-muted hover:text-red-600 shrink-0"
            title="Quitar dominio"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <div className="px-5 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && hostname.trim() && onAdd()}
            placeholder="ofertas.tunegocio.com"
            className={`${ui.input} max-w-sm font-mono text-sm`}
          />
          <button
            onClick={onAdd}
            disabled={busy || !hostname.trim()}
            className={`${ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}
          >
            <Plus size={15} /> Añadir
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ol className="text-xs text-muted list-decimal ml-4 space-y-0.5 pt-1">
          <li>En el proveedor del dominio: registro A (o CNAME) apuntando a la IP de tu VPS.</li>
          <li>En EasyPanel: añade el dominio al servicio de GHL Titan (Domains) — el candado HTTPS se emite solo.</li>
          <li>Añádelo aquí. En 1-2 minutos (cuando propague el DNS) el embudo se sirve desde ese dominio.</li>
        </ol>
      </div>
    </div>
  )
}
