import Link from 'next/link'
import { MousePointerClick } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { CampaignListItem, RecipientRow } from '../services/queries'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
}

const RECIPIENT_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  failed: 'Fallido',
  skipped: 'Omitido',
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

function FunnelBar({ label, value, total, opacity }: { label: string; value: number; total: number; opacity: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-muted text-right shrink-0">{label}</span>
      <div className="flex-1 h-7 rounded-md bg-bg overflow-hidden">
        {/* opacidad inline: bg-primary/40 no funciona con colores var(--primary) */}
        <div className="h-full bg-primary transition-all" style={{ width: `${pct(value, total)}%`, opacity }} />
      </div>
      <span className="w-24 text-sm shrink-0">
        <strong>{value}</strong> <span className="text-muted">({pct(value, total)}%)</span>
      </span>
    </div>
  )
}

/** Pestaña Estadísticas: embudo tipo GHL + tabla por campaña + detalle de destinatarios. */
export function StatsView({
  campaigns,
  selectedId,
  recipients,
}: {
  campaigns: CampaignListItem[]
  selectedId: string | null
  recipients: RecipientRow[] | null
}) {
  if (campaigns.length === 0) {
    return (
      <div className={`${ui.card} p-8 text-center text-muted`}>
        Aún no hay campañas enviadas. Cuando envíes tu primera campaña verás aquí sus resultados.
      </div>
    )
  }

  const selected = campaigns.find((c) => c.id === selectedId) ?? null
  const scope = selected ? [selected] : campaigns
  const totals = scope.reduce(
    (acc, c) => ({
      recipients: acc.recipients + c.recipients,
      sent: acc.sent + c.sent,
      clicks: acc.clicks + c.clicks,
    }),
    { recipients: 0, sent: 0, clicks: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Selector de campaña */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/marketing"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            !selected ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:text-fg'
          }`}
        >
          Todas las campañas
        </Link>
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/marketing?tab=stats&campaign=${c.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected?.id === c.id ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:text-fg'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Embudo resumen */}
      <div className={`${ui.card} p-6 space-y-3`}>
        <h2 className="font-semibold mb-1">Resumen de interacciones</h2>
        <FunnelBar label="Destinatarios" value={totals.recipients} total={totals.recipients} opacity={0.35} />
        <FunnelBar label="Entregados" value={totals.sent} total={totals.recipients} opacity={0.65} />
        <FunnelBar label="Con click" value={totals.clicks} total={totals.recipients} opacity={1} />
        <p className="text-xs text-muted pt-1">
          Tasa de clicks sobre entregados: <strong>{pct(totals.clicks, totals.sent)}%</strong>
        </p>
      </div>

      {/* Tabla por campaña */}
      <div className={`${ui.card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Campaña</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Destinatarios</th>
              <th className="px-4 py-3 font-medium text-right">Enviados</th>
              <th className="px-4 py-3 font-medium text-right">Fallidos</th>
              <th className="px-4 py-3 font-medium text-right">Omitidos</th>
              <th className="px-4 py-3 font-medium text-right">Clicks</th>
              <th className="px-4 py-3 font-medium text-right">Tasa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scope.map((c) => (
              <tr key={c.id} className="hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`/marketing?tab=stats&campaign=${c.id}`} className="font-medium hover:text-primary">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{STATUS_LABEL[c.status] ?? c.status}</td>
                <td className="px-4 py-3 text-right">{c.recipients}</td>
                <td className="px-4 py-3 text-right">{c.sent}</td>
                <td className="px-4 py-3 text-right">{c.failed}</td>
                <td className="px-4 py-3 text-right">{c.skipped}</td>
                <td className="px-4 py-3 text-right">{c.clicks}</td>
                <td className="px-4 py-3 text-right font-medium">{pct(c.clicks, c.sent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle de destinatarios */}
      {selected && recipients && (
        <div className={`${ui.card} overflow-x-auto`}>
          <div className="px-4 pt-4 pb-2">
            <h3 className="font-semibold">Destinatarios de «{selected.name}»</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Click</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recipients.map((r) => (
                <tr key={r.id} className="hover:bg-bg">
                  <td className="px-4 py-2.5">
                    <Link href={`/contacts/${r.contact_id}`} className="hover:text-primary">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ') || '(sin nombre)'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{r.to_email}</td>
                  <td className="px-4 py-2.5">
                    {RECIPIENT_LABEL[r.status] ?? r.status}
                    {r.status === 'failed' && r.error && (
                      <span className="block text-xs text-red-600 truncate max-w-60" title={r.error}>{r.error}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.clicked_at ? (
                      <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                        <MousePointerClick size={14} />
                        {new Date(r.clicked_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
