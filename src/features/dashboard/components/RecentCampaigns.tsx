import Link from 'next/link'
import { ui } from '@/shared/lib/ui'
import { OPENS_NOTE, NOT_TRACKED } from '@/features/marketing/components/StatsView'
import type { RecentCampaign } from '../services/queries'

const NO_CONVERSIONS = 'Todavía no medimos ventas: se activará cuando conectemos la venta de entradas'

const pct = (n: number, total: number) =>
  total > 0 ? `${((n / total) * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} %` : '0 %'

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="text-right" title={title}>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  )
}

export function RecentCampaigns({ campaigns }: { campaigns: RecentCampaign[] }) {
  return (
    <div className={`${ui.card} divide-y divide-border`}>
      <div className="px-5 py-4 flex items-center justify-between">
        <h2 className="font-semibold">Tus últimas campañas</h2>
        <Link href="/marketing?tab=campaigns" className="text-sm text-primary hover:underline">
          Ver campañas
        </Link>
      </div>
      {campaigns.length === 0 && (
        <p className="px-5 py-8 text-sm text-muted text-center">Aún no has enviado ninguna campaña.</p>
      )}
      {campaigns.map((c) => (
        <Link
          key={c.id}
          href={`/marketing?tab=stats&campaign=${c.id}`}
          className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 hover:bg-bg transition-colors"
        >
          <div className="flex-1 min-w-48">
            <p className="text-sm font-semibold truncate">{c.name}</p>
            <p className="text-xs text-muted mt-1">
              Enviada el{' '}
              {new Date(c.started_at).toLocaleString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Madrid',
              })}{' '}
              · {c.sent} {c.sent === 1 ? 'destinatario' : 'destinatarios'}
            </p>
            <p className="text-xs mt-1.5 inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${c.status === 'sent' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {c.status === 'sent' ? 'Enviada' : 'Enviando'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Metric
              label="Índice de apertura"
              value={c.opens_tracked ? pct(c.opens, c.sent) : '—'}
              title={c.opens_tracked ? OPENS_NOTE : NOT_TRACKED}
            />
            <Metric label="Índice de clics" value={pct(c.clicks, c.sent)} />
            <Metric label="Conversiones" value="—" title={NO_CONVERSIONS} />
          </div>
        </Link>
      ))}
      {campaigns.length > 0 && <p className="px-5 py-3 text-xs text-muted">{OPENS_NOTE}</p>}
    </div>
  )
}
