import Link from 'next/link'
import { MousePointerClick, Users } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { CampaignListItem } from '../services/queries'
import { CreateCampaignButton } from './CreateCampaignButton'

const STATUS_META: Record<CampaignListItem['status'], { label: string; classes: string }> = {
  draft: { label: 'Borrador', classes: 'bg-bg text-muted' },
  scheduled: { label: 'Programada', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  sending: { label: 'Enviando', classes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  sent: { label: 'Enviada', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
}

export function CampaignList({ campaigns }: { campaigns: CampaignListItem[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateCampaignButton />
      </div>
      {campaigns.length === 0 ? (
        <div className={`${ui.card} p-8 text-center text-muted`}>
          Aún no tienes campañas. Crea la primera y diséñala a tu gusto.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const st = STATUS_META[c.status]
            return (
              <Link
                key={c.id}
                href={`/marketing/campaigns/${c.id}`}
                className={`${ui.card} p-5 hover:border-primary transition-colors`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.classes}`}>{st.label}</span>
                </div>
                <p className="text-sm text-muted mt-1 truncate">
                  {c.subject || 'Sin asunto'}
                </p>
                {c.recipients > 0 && (
                  <p className="text-sm text-muted mt-2 inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} /> {c.sent}/{c.recipients} enviados
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MousePointerClick size={14} /> {c.clicks} clicks
                    </span>
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
