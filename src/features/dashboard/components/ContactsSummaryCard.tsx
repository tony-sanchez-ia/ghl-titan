import Link from 'next/link'
import { UserPlus, Users } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { ContactsSummary } from '../services/queries'

function Stat({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString('es-ES')}</p>
        <p className="text-sm text-muted mt-0.5">{label}</p>
      </div>
      <span className="h-11 w-11 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </span>
    </div>
  )
}

export function ContactsSummaryCard({ summary }: { summary: ContactsSummary }) {
  return (
    <div className={`${ui.card} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tus contactos</h2>
        <Link href="/contacts/new" className="text-sm text-primary hover:underline">
          Añadir contactos
        </Link>
      </div>
      <Stat value={summary.total} label="Total de contactos" icon={Users} />
      <Stat value={summary.new_30d} label="Nuevos en los últimos 30 días" icon={UserPlus} />
      {summary.unsubscribed > 0 && (
        <p className="text-xs text-muted">
          {summary.unsubscribed.toLocaleString('es-ES')} dados de baja (no reciben campañas).
        </p>
      )}
      <Link href="/contacts" className="block text-center text-sm text-primary hover:underline pt-1">
        Ir a Contactos
      </Link>
    </div>
  )
}
