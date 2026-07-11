import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getFirstStep,
  getFunnelByHostname,
  getStepBySlug,
} from '@/features/funnels/services/queries'
import { PublicStep } from '@/features/funnels/components/PublicStep'
import {
  getPublicWebsitePage,
  getWebsiteByHostname,
} from '@/features/websites/services/queries'
import { PublicWebsitePage } from '@/features/websites/components/PublicWebsitePage'
import type { Funnel, FunnelStep, Website, WebsitePage } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Destino del rewrite multidominio de proxy.ts: sirve el FUNNEL o el SITIO WEB
 * asociado al dominio desde su raíz (`/` = primer paso/home, `/slug` = paso o
 * página). Las URLs generadas son RELATIVAS al dominio (nunca NEXT_PUBLIC_SITE_URL).
 */
type Resolved =
  | { kind: 'funnel'; funnel: Funnel; step: FunnelStep }
  | { kind: 'website'; website: Website; page: WebsitePage }

async function resolve(host: string, path: string[] | undefined): Promise<Resolved | null> {
  const funnel = await getFunnelByHostname(host)
  if (funnel) {
    const step =
      path && path.length > 0
        ? await getStepBySlug(funnel.id, path[0])
        : await getFirstStep(funnel.id)
    if (!step) return null
    return { kind: 'funnel', funnel, step }
  }

  const website = await getWebsiteByHostname(host)
  if (website) {
    const page = await getPublicWebsitePage(website.id, path?.[0])
    if (!page) return null
    return { kind: 'website', website, page }
  }

  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; path?: string[] }>
}): Promise<Metadata> {
  const { host, path } = await params
  const found = await resolve(host, path)
  if (!found) return { title: 'Página no encontrada' }
  if (found.kind === 'funnel') {
    return {
      title: found.step.seo_title || found.step.name,
      description: found.step.seo_description || undefined,
    }
  }
  return {
    title: found.page.seo_title || found.page.name,
    description: found.page.seo_description || undefined,
    icons: found.website.favicon_url ? { icon: found.website.favicon_url } : undefined,
  }
}

export default async function CustomDomainPage({
  params,
}: {
  params: Promise<{ host: string; path?: string[] }>
}) {
  const { host, path } = await params
  const found = await resolve(host, path)
  if (!found) notFound()

  if (found.kind === 'funnel') {
    return <PublicStep funnel={found.funnel} step={found.step} basePath="" />
  }
  return <PublicWebsitePage website={found.website} page={found.page} />
}
