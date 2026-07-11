import { query, queryOne } from '@/lib/db'
import type { Website, WebsiteDomain, WebsitePage } from '@/types/database'

export interface WebsiteListItem extends Website {
  pageCount: number
  hostnames: string[]
}

/** [admin] Sitios web con conteo de páginas y dominios asociados. */
export async function listWebsites(): Promise<WebsiteListItem[]> {
  const rows = await query<Website & { page_count: string; hostnames: string[] | null }>(
    `select w.*,
       (select count(*) from website_pages p where p.website_id = w.id) as page_count,
       (select array_agg(d.hostname order by d.created_at) from website_domains d where d.website_id = w.id) as hostnames
     from websites w order by w.updated_at desc`
  )
  return rows.map(({ page_count, hostnames, ...w }) => ({
    ...w,
    pageCount: Number(page_count),
    hostnames: hostnames ?? [],
  }))
}

export interface WebsiteWithContent extends Website {
  pages: WebsitePage[]
  domains: WebsiteDomain[]
}

/** [admin] Sitio completo para el panel (páginas + dominios). */
export async function getWebsite(id: string): Promise<WebsiteWithContent | null> {
  const website = await queryOne<Website>(`select * from websites where id = $1`, [id])
  if (!website) return null
  const [pages, domains] = await Promise.all([
    query<WebsitePage>(
      `select * from website_pages where website_id = $1 order by is_home desc, position, created_at`,
      [id]
    ),
    query<WebsiteDomain>(
      `select * from website_domains where website_id = $1 order by created_at`,
      [id]
    ),
  ])
  return { ...website, pages, domains }
}

/** [admin] Una página con su sitio (para el editor). */
export async function getWebsitePage(
  pageId: string
): Promise<{ page: WebsitePage; website: Website } | null> {
  const page = await queryOne<WebsitePage>(`select * from website_pages where id = $1`, [pageId])
  if (!page) return null
  const website = await queryOne<Website>(`select * from websites where id = $1`, [page.website_id])
  if (!website) return null
  return { page, website }
}

/** [público] Sitio publicado por slug (vista previa /w/[slug] en dominio principal). */
export async function getPublishedWebsiteBySlug(slug: string): Promise<Website | null> {
  return queryOne<Website>(`select * from websites where slug = $1 and status = 'published'`, [slug])
}

/** [público] Sitio publicado asociado a un dominio propio. */
export async function getWebsiteByHostname(hostname: string): Promise<Website | null> {
  return queryOne<Website>(
    `select w.* from websites w
     join website_domains d on d.website_id = w.id
     where d.hostname = $1 and w.status = 'published'`,
    [hostname.toLowerCase()]
  )
}

/** [público] Página del sitio: slug concreto, o la home si no se pasa slug. */
export async function getPublicWebsitePage(
  websiteId: string,
  slug?: string
): Promise<WebsitePage | null> {
  if (slug) {
    return queryOne<WebsitePage>(
      `select * from website_pages where website_id = $1 and slug = $2`,
      [websiteId, slug]
    )
  }
  return queryOne<WebsitePage>(
    `select * from website_pages where website_id = $1
     order by is_home desc, position, created_at limit 1`,
    [websiteId]
  )
}
