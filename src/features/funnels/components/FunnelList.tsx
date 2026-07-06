import Link from 'next/link'
import { Layers, Globe } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { FunnelListItem } from '../services/queries'
import { CreateFunnelDialog } from './CreateFunnelDialog'

const STATUS_META: Record<FunnelListItem['status'], { label: string; classes: string }> = {
  draft: { label: 'Borrador', classes: 'bg-bg text-muted' },
  published: {
    label: 'Publicado',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
}

export function FunnelList({
  funnels,
  aiEnabled,
}: {
  funnels: FunnelListItem[]
  aiEnabled: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateFunnelDialog aiEnabled={aiEnabled} />
      </div>
      {funnels.length === 0 ? (
        <div className={`${ui.card} p-8 text-center text-muted`}>
          Aún no tienes embudos. Crea el primero: dale un nombre y, si quieres, un brief para
          que la IA diseñe la página por ti.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {funnels.map((f) => {
            const st = STATUS_META[f.status]
            return (
              <Link
                key={f.id}
                href={`/funnels/${f.id}`}
                className={`${ui.card} p-5 hover:border-primary transition-colors`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold truncate">{f.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.classes}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm text-muted mt-1 truncate">/p/{f.slug}</p>
                <p className="text-sm text-muted mt-2 inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers size={14} /> {f.steps} {f.steps === 1 ? 'paso' : 'pasos'}
                  </span>
                  {f.domains > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe size={14} /> {f.domains} {f.domains === 1 ? 'dominio' : 'dominios'}
                    </span>
                  )}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
