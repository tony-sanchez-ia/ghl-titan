import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getPublicWebsitePage,
  getPublishedWebsiteBySlug,
} from '@/features/websites/services/queries'
import { PublicWebsitePage } from '@/features/websites/components/PublicWebsitePage'

export const dynamic = 'force-dynamic'

/**
 * Vista pública de un sitio web en el dominio principal: /w/[slug] (home)
 * y /w/[slug]/[pagina]. En dominio propio se sirve vía /sites/[host].
 */
async function resolve(site: string, page?: string[]) {
  const website = await getPublishedWebsiteBySlug(site)
  if (!website) return null
  const pg = await getPublicWebsitePage(website.id, page?.[0])
  if (!pg) return null
  return { website, page: pg }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; page?: string[] }>
}): Promise<Metadata> {
  const { site, page } = await params
  const data = await resolve(site, page)
  if (!data) return { title: 'Página no encontrada' }
  return {
    title: data.page.seo_title || data.page.name,
    description: data.page.seo_description || undefined,
    icons: data.website.favicon_url ? { icon: data.website.favicon_url } : undefined,
  }
}

export default async function PublicWebsiteRoute({
  params,
}: {
  params: Promise<{ site: string; page?: string[] }>
}) {
  const { site, page } = await params
  const data = await resolve(site, page)
  if (!data) notFound()

  return <PublicWebsitePage website={data.website} page={data.page} />
}
