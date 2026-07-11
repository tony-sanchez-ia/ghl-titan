import { BarChart3, Eye, MousePointerClick, Send } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { FormStats } from '../services/tracking'

export function FormAnalytics({ stats }: { stats: FormStats }) {
  const conversion = stats.views > 0 ? Math.min(100, Math.round((stats.submissions / stats.views) * 100)) : 0

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Eye size={18} />} label="Vistas" value={stats.views} hint="Visitantes únicos" />
        <Stat icon={<Send size={18} />} label="Envíos" value={stats.submissions} hint="Formularios completados" />
        <Stat icon={<MousePointerClick size={18} />} label="Conversión" value={`${conversion}%`} hint="Envíos ÷ vistas" />
      </div>
      <div className={`${ui.card} p-4 text-sm text-muted inline-flex items-center gap-2`}>
        <BarChart3 size={16} className="text-primary" />
        Las vistas cuentan visitantes únicos por día (no se inflan con recargas). Los envíos incluyen todas las fuentes: enlace, iframe y funnels.
      </div>
    </div>
  )
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint: string }) {
  return (
    <div className={`${ui.card} p-4`}>
      <div className="flex items-center gap-2 text-muted text-sm">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted mt-1">{hint}</div>
    </div>
  )
}
