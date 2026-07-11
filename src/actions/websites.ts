'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { aiAvailable } from '@/lib/ai/openrouter'
import {
  generateWebsitePages,
  rewriteText,
  type AiGeneratedStep,
} from '@/features/funnels/services/ai-generate'
import { defaultPageDesign } from '@/features/funnels/services/design'
import {
  hostnameSchema,
  normalizePageDesign,
  pageDesignSchema,
} from '@/features/funnels/services/page-design-schema'
import type { PageDesign, WebsiteStatus } from '@/types/database'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

const nameSchema = z.string().trim().min(1, 'El nombre es obligatorio').max(160)
const briefSchema = z.string().trim().max(4000).optional()

// ─── Sitios ──────────────────────────────────────────────────────────────────

/**
 * Crea el sitio web. Con brief + IA configurada, la IA genera las páginas con
 * su copy (la primera es la home); si falla, se crea la página "Inicio" vacía.
 */
export async function createWebsite(input: {
  name: string
  brief?: string
}): Promise<{ id?: string; error?: string; aiError?: string }> {
  const parsed = z.object({ name: nameSchema, brief: briefSchema }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { name, brief } = parsed.data

  let generated: AiGeneratedStep[] | null = null
  let aiError: string | undefined
  if (brief && aiAvailable()) {
    try {
      generated = await generateWebsitePages({ siteName: name, brief })
    } catch (err) {
      aiError = `La IA no pudo generar las páginas (${(err as Error).message}). El sitio se creó vacío.`
    }
  }

  const base = slugify(name) || 'sitio'
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    try {
      const row = await queryOne<{ id: string }>(
        `insert into websites (name, slug, brief) values ($1, $2, $3) returning id`,
        [name, slug, brief || null]
      )

      const pages: { name: string; seo_title?: string; seo_description?: string; design: PageDesign }[] =
        generated ?? [{ name: 'Inicio', design: defaultPageDesign() }]

      const usedSlugs = new Set<string>()
      for (const [pos, p] of pages.entries()) {
        let pageSlug = slugify(p.name) || `pagina-${pos + 1}`
        while (usedSlugs.has(pageSlug)) pageSlug = `${pageSlug}-2`
        usedSlugs.add(pageSlug)
        await query(
          `insert into website_pages (website_id, slug, name, is_home, position, seo_title, seo_description, design)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            row!.id,
            pageSlug,
            p.name,
            pos === 0, // la primera página es la home
            pos,
            p.seo_title ?? null,
            p.seo_description ?? null,
            JSON.stringify(p.design),
          ]
        )
      }

      revalidatePath('/websites')
      return { id: row!.id, aiError }
    } catch (err) {
      if (!isUniqueViolation(err)) return { error: (err as Error).message }
    }
  }
  return { error: 'Ya existen varios sitios con ese nombre: usa otro' }
}

export async function renameWebsite(
  id: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  await query(`update websites set name = $1, updated_at = now() where id = $2`, [parsed.data, id])
  revalidatePath('/websites')
  revalidatePath(`/websites/${id}`)
  return { success: true }
}

export async function setWebsiteStatus(
  id: string,
  status: WebsiteStatus
): Promise<{ success?: boolean; error?: string }> {
  await query(`update websites set status = $1, updated_at = now() where id = $2`, [status, id])
  revalidatePath('/websites')
  revalidatePath(`/websites/${id}`)
  return { success: true }
}

export async function deleteWebsite(id: string): Promise<{ success?: boolean; error?: string }> {
  await query(`delete from websites where id = $1`, [id])
  revalidatePath('/websites')
  return { success: true }
}

const settingsSchema = z.object({
  favicon_url: z.string().trim().url('URL de favicon inválida').max(1000).or(z.literal('')),
  head_scripts: z.string().max(20000),
  body_scripts: z.string().max(20000),
})

/** Identidad y seguimiento del sitio (favicon + scripts GA/Pixel). Solo admin. */
export async function updateWebsiteSettings(
  id: string,
  input: { favicon_url: string; head_scripts: string; body_scripts: string }
): Promise<{ success?: boolean; error?: string }> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  await query(
    `update websites set favicon_url = $1, head_scripts = $2, body_scripts = $3, updated_at = now()
     where id = $4`,
    [
      parsed.data.favicon_url || null,
      parsed.data.head_scripts.trim() || null,
      parsed.data.body_scripts.trim() || null,
      id,
    ]
  )
  revalidatePath(`/websites/${id}`)
  return { success: true }
}

/** Reescribe con IA el texto de un bloque usando el brief del sitio. */
export async function rewriteWebsiteBlockText(
  websiteId: string,
  input: { current: string; kind: 'heading' | 'text' }
): Promise<{ text?: string; error?: string }> {
  if (!aiAvailable()) return { error: 'La IA no está configurada (falta OPENROUTER_API_KEY)' }
  const parsed = z
    .object({ current: z.string().trim().min(1, 'El bloque está vacío').max(4000), kind: z.enum(['heading', 'text']) })
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const site = await queryOne<{ brief: string | null }>(`select brief from websites where id = $1`, [websiteId])
  try {
    const text = await rewriteText({
      current: parsed.data.current,
      kind: parsed.data.kind,
      brief: site?.brief ?? null,
    })
    return { text }
  } catch (err) {
    return { error: `La IA no pudo reescribir el texto (${(err as Error).message})` }
  }
}

// ─── Páginas ─────────────────────────────────────────────────────────────────

export async function createWebsitePage(
  websiteId: string,
  name: string
): Promise<{ id?: string; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }

  const base = slugify(parsed.data) || 'pagina'
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    try {
      const row = await queryOne<{ id: string }>(
        `insert into website_pages (website_id, slug, name, position, design)
         values ($1, $2, $3,
           (select count(*) from website_pages where website_id = $1), $4)
         returning id`,
        [websiteId, slug, parsed.data, JSON.stringify(defaultPageDesign())]
      )
      revalidatePath(`/websites/${websiteId}`)
      return { id: row!.id }
    } catch (err) {
      if (!isUniqueViolation(err)) return { error: (err as Error).message }
    }
  }
  return { error: 'Ya existen varias páginas con ese nombre: usa otro' }
}

export async function renameWebsitePage(
  pageId: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  const row = await queryOne<{ website_id: string }>(
    `update website_pages set name = $1, updated_at = now() where id = $2 returning website_id`,
    [parsed.data, pageId]
  )
  if (row) revalidatePath(`/websites/${row.website_id}`)
  return { success: true }
}

/** Marca la página como home del sitio (la raíz del dominio). */
export async function setWebsiteHomePage(
  pageId: string
): Promise<{ success?: boolean; error?: string }> {
  const page = await queryOne<{ website_id: string }>(
    `select website_id from website_pages where id = $1`,
    [pageId]
  )
  if (!page) return { error: 'Página no encontrada' }
  await query(`update website_pages set is_home = (id = $1) where website_id = $2`, [
    pageId,
    page.website_id,
  ])
  revalidatePath(`/websites/${page.website_id}`)
  return { success: true }
}

export async function deleteWebsitePage(
  pageId: string
): Promise<{ success?: boolean; error?: string }> {
  const row = await queryOne<{ website_id: string; is_home: boolean }>(
    `delete from website_pages where id = $1 returning website_id, is_home`,
    [pageId]
  )
  if (row) revalidatePath(`/websites/${row.website_id}`)
  return { success: true }
}

/** Guarda el diseño de una página (autosave del editor). Mismo saneado que funnels. */
export async function saveWebsitePageDesign(
  pageId: string,
  design: PageDesign
): Promise<{ success?: boolean; error?: string }> {
  const parsed = pageDesignSchema.safeParse(design)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Diseño inválido' }
  if (JSON.stringify(parsed.data).length > 200_000) return { error: 'El diseño es demasiado grande' }
  const row = await queryOne<{ id: string }>(
    `update website_pages set design = $1, updated_at = now() where id = $2 returning id`,
    [JSON.stringify(normalizePageDesign(parsed.data)), pageId]
  )
  if (!row) return { error: 'Página no encontrada' }
  return { success: true }
}

const seoSchema = z.object({
  seo_title: z.string().trim().max(160),
  seo_description: z.string().trim().max(300),
})

export async function saveWebsitePageSeo(
  pageId: string,
  input: { seo_title: string; seo_description: string }
): Promise<{ success?: boolean; error?: string }> {
  const parsed = seoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  await query(
    `update website_pages set seo_title = $1, seo_description = $2, updated_at = now() where id = $3`,
    [parsed.data.seo_title || null, parsed.data.seo_description || null, pageId]
  )
  return { success: true }
}

// ─── Dominios propios ────────────────────────────────────────────────────────

/** Asocia un dominio propio al sitio (el alta DNS + EasyPanel es manual, ver DEPLOY.md). */
export async function addWebsiteDomain(
  websiteId: string,
  hostname: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = hostnameSchema.safeParse(hostname.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dominio inválido' }
  // Un dominio no puede apuntar a la vez a un embudo y a un sitio web
  const taken = await queryOne<{ id: string }>(
    `select id from funnel_domains where hostname = $1`,
    [parsed.data]
  )
  if (taken) return { error: 'Ese dominio ya está asociado a un embudo' }
  try {
    await query(`insert into website_domains (hostname, website_id) values ($1, $2)`, [
      parsed.data,
      websiteId,
    ])
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ese dominio ya está asociado a un sitio web' }
    return { error: (err as Error).message }
  }
  revalidatePath(`/websites/${websiteId}`)
  return { success: true }
}

export async function removeWebsiteDomain(
  domainId: string
): Promise<{ success?: boolean; error?: string }> {
  const row = await queryOne<{ website_id: string }>(
    `delete from website_domains where id = $1 returning website_id`,
    [domainId]
  )
  if (row) revalidatePath(`/websites/${row.website_id}`)
  return { success: true }
}
