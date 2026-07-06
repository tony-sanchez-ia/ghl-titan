import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, FileInput, MousePointerClick, Users } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  getAbStats,
  getFunnel,
  getFunnelStats,
  type AbVariantStats,
} from '@/features/funnels/services/queries'

const RANGES = [
  { key: '7', label: '7 días', days: 7 },
  { key: '30', label: '30 días', days: 30 },
  { key: 'all', label: 'Todo', days: null },
] as const

function pct(part: number, total: number): string {
  if (total <= 0) return '–'
  return `${Math.round((part / total) * 100)}%`
}

function AbTable({ stats }: { stats: AbVariantStats[] }) {
  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg text-muted text-xs">
            <th className="px-3 py-1.5 text-left font-medium">Variante</th>
            <th className="px-3 py-1.5 text-right font-medium">Visitantes</th>
            <th className="px-3 py-1.5 text-right font-medium">Clicks</th>
            <th className="px-3 py-1.5 text-right font-medium">Conversiones</th>
            <th className="px-3 py-1.5 text-right font-medium">Conversión</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((v) => (
            <tr key={v.variant_key} className="border-t border-border">
              <td className="px-3 py-1.5 font-semibold">{v.variant_key}</td>
              <td className="px-3 py-1.5 text-right">{v.visitors}</td>
              <td className="px-3 py-1.5 text-right">{v.clickers}</td>
              <td className="px-3 py-1.5 text-right">{v.conversions}</td>
              <td className="px-3 py-1.5 text-right font-medium">{pct(v.conversions, v.visitors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function FunnelStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const { id } = await params
  const { range } = await searchParams
  const funnel = await getFunnel(id)
  if (!funnel) notFound()

  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[2]
  const steps = await getFunnelStats(id, activeRange.days)
  const abByStep = new Map<string, AbVariantStats[]>()
  for (const s of steps) {
    if (s.ab_active) abByStep.set(s.step_id, await getAbStats(s.step_id, activeRange.days))
  }

  const totalVisitors = steps[0]?.visitors ?? 0
  const totalConversions = steps.reduce((acc, s) => acc + s.conversions, 0)

  return (
    <div className="space-y-6">
      <Link
        href={`/funnels/${funnel.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={15} /> {funnel.name}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estadísticas del embudo</h1>
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/funnels/${funnel.id}/stats${r.key === 'all' ? '' : `?range=${r.key}`}`}
              className={`px-3 py-1.5 text-sm ${
                activeRange.key === r.key ? 'bg-primary-soft text-primary font-medium' : 'text-muted'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className={`${ui.card} p-4`}>
          <p className="text-xs text-muted inline-flex items-center gap-1.5">
            <Users size={13} /> Visitantes (paso 1)
          </p>
          <p className="text-2xl font-bold mt-1">{totalVisitors}</p>
        </div>
        <div className={`${ui.card} p-4`}>
          <p className="text-xs text-muted inline-flex items-center gap-1.5">
            <FileInput size={13} /> Conversiones totales
          </p>
          <p className="text-2xl font-bold mt-1">{totalConversions}</p>
        </div>
        <div className={`${ui.card} p-4`}>
          <p className="text-xs text-muted">Conversión global</p>
          <p className="text-2xl font-bold mt-1">{pct(totalConversions, totalVisitors)}</p>
        </div>
      </div>

      {/* Embudo por pasos */}
      <div className={`${ui.card} divide-y divide-border`}>
        {steps.length === 0 && (
          <p className="p-8 text-center text-muted text-sm">Este embudo aún no tiene pasos.</p>
        )}
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1] : null
          const width = totalVisitors > 0 ? Math.max((s.visitors / totalVisitors) * 100, 2) : 0
          return (
            <div key={s.step_id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-soft text-primary text-xs font-semibold inline-flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium">{s.name}</span>
                {s.ab_active && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-soft text-primary uppercase">
                    A/B
                  </span>
                )}
                {prev && (
                  <span className="text-xs text-muted">
                    {pct(s.visitors, prev.visitors)} llega desde el paso anterior
                  </span>
                )}
                <div className="flex-1" />
                <span className="text-sm text-muted inline-flex items-center gap-4">
                  <span className="inline-flex items-center gap-1" title="Visitantes únicos">
                    <Users size={13} /> {s.visitors}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Vistas">
                    <Eye size={13} /> {s.views}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Clicks de CTA">
                    <MousePointerClick size={13} /> {s.clickers}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Envíos de formulario">
                    <FileInput size={13} /> {s.conversions}
                  </span>
                </span>
              </div>
              {totalVisitors > 0 && (
                <div className="mt-2 h-2 rounded-full bg-bg overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${width}%`, opacity: 0.85 }} />
                </div>
              )}
              {abByStep.has(s.step_id) && <AbTable stats={abByStep.get(s.step_id)!} />}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted">
        Visitantes y conversiones son personas únicas; las vistas cuentan una por persona y día.
      </p>
    </div>
  )
}
