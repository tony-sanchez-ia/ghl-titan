import { Activity } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { HealthCheck, HealthStatus } from '@/features/dashboard/services/health'

const HEALTH_DOT: Record<HealthStatus, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
}

/** Estado de las conexiones (BD, auth, emails, IA, cron). Antes vivía en el Inicio. */
export function SystemHealthCard({ health }: { health: HealthCheck[] }) {
  return (
    <div className={`${ui.card} p-5`}>
      <h2 className="font-semibold inline-flex items-center gap-2">
        <Activity size={16} className="text-primary" /> Salud del sistema
      </h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {health.map((h) => (
          <div key={h.key} className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs font-medium inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[h.status]}`} />
              {h.label}
            </p>
            <p className="text-xs text-muted mt-1 leading-snug">{h.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
