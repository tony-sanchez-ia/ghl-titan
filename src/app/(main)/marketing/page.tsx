import Link from 'next/link'
import { BarChart3, Mail, LayoutTemplate } from 'lucide-react'
import { listCampaigns, listCampaignRecipients, listTemplates } from '@/features/marketing/services/queries'
import { CampaignList } from '@/features/marketing/components/CampaignList'
import { TemplateList } from '@/features/marketing/components/TemplateList'
import { StatsView } from '@/features/marketing/components/StatsView'

const TABS = [
  { key: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { key: 'campaigns', label: 'Campañas', icon: Mail },
  { key: 'templates', label: 'Plantillas', icon: LayoutTemplate },
] as const

type TabKey = (typeof TABS)[number]['key']

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; campaign?: string }>
}) {
  const { tab, campaign } = await searchParams
  const active: TabKey = tab === 'campaigns' || tab === 'templates' ? tab : 'stats'
  const campaigns = active === 'campaigns' || active === 'stats' ? await listCampaigns() : []
  const templates = active === 'templates' ? await listTemplates() : []

  // Estadísticas: solo campañas con actividad de envío
  const statsCampaigns = campaigns.filter((c) => c.status !== 'draft')
  const selectedId =
    active === 'stats' && campaign && statsCampaigns.some((c) => c.id === campaign) ? campaign : null
  const recipients = selectedId ? await listCampaignRecipients(selectedId) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing por correo electrónico</h1>
        <p className="mt-1 text-muted">Campañas de email a tu lista de contactos, con medición de clicks.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.key}
              href={t.key === 'stats' ? '/marketing' : `/marketing?tab=${t.key}`}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </Link>
          )
        })}
      </div>

      {active === 'stats' && (
        <StatsView campaigns={statsCampaigns} selectedId={selectedId} recipients={recipients} />
      )}
      {active === 'campaigns' && <CampaignList campaigns={campaigns} />}
      {active === 'templates' && <TemplateList templates={templates} />}
    </div>
  )
}
