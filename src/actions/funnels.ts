'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { aiAvailable } from '@/lib/ai/openrouter'
import { generateFunnelPages, rewriteText, type AiGeneratedStep } from '@/features/funnels/services/ai-generate'
import { defaultPageDesign } from '@/features/funnels/services/design'
import {
  hostnameSchema,
  normalizePageDesign,
  pageDesignSchema,
} from '@/features/funnels/services/page-design-schema'
import type { FunnelStatus, PageDesign } from '@/types/database'

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

// ─── Funnels ─────────────────────────────────────────────────────────────────

/**
 * Crea el funnel. Con brief + IA configurada, la IA genera los pasos con su
 * copy completo; si la IA falla (o no hay API key) se crea el paso "Inicio"
 * vacío y se avisa sin romper. Si el slug choca, prueba sufijos -2..-5.
 */
export async function createFunnel(input: {
  name: string
  brief?: string
}): Promise<{ id?: string; error?: string; aiError?: string }> {
  const parsed = z.object({ name: nameSchema, brief: briefSchema }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { name, brief } = parsed.data

  // La IA diseña ANTES de tocar la BD (si falla, seguimos con el paso vacío)
  let generated: AiGeneratedStep[] | null = null
  let aiError: string | undefined
  if (brief && aiAvailable()) {
    try {
      generated = await generateFunnelPages({ funnelName: name, brief })
    } catch (err) {
      aiError = `La IA no pudo generar la página (${(err as Error).message}). El embudo se creó vacío.`
    }
  }

  const base = slugify(name) || 'funnel'
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    try {
      const row = await queryOne<{ id: string }>(
        `insert into funnels (name, slug, brief) values ($1, $2, $3) returning id`,
        [name, slug, brief || null]
      )

      const steps: { name: string; seo_title?: string; seo_description?: string; design: PageDesign }[] =
        generated ?? [{ name: 'Inicio', design: defaultPageDesign() }]

      const usedSlugs = new Set<string>()
      for (const [pos, s] of steps.entries()) {
        let stepSlug = slugify(s.name) || `paso-${pos + 1}`
        while (usedSlugs.has(stepSlug)) stepSlug = `${stepSlug}-2`
        usedSlugs.add(stepSlug)
        const step = await queryOne<{ id: string }>(
          `insert into funnel_steps (funnel_id, slug, name, position, seo_title, seo_description)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [row!.id, stepSlug, s.name, pos, s.seo_title ?? null, s.seo_description ?? null]
        )
        await query(
          `insert into funnel_step_variants (step_id, variant_key, design) values ($1, 'A', $2)`,
          [step!.id, JSON.stringify(s.design)]
        )
      }

      revalidatePath('/funnels')
      return { id: row!.id, aiError }
    } catch (err) {
      if (!isUniqueViolation(err)) return { error: (err as Error).message }
    }
  }
  return { error: 'Ya existen varios funnels con ese nombre: usa otro' }
}

/** Reescribe con IA el texto de un bloque (titular/párrafo) usando el brief del funnel. */
export async function rewriteBlockText(
  funnelId: string,
  input: { current: string; kind: 'heading' | 'text' }
): Promise<{ text?: string; error?: string }> {
  if (!aiAvailable()) return { error: 'La IA no está configurada (falta OPENROUTER_API_KEY)' }
  const parsed = z
    .object({ current: z.string().trim().min(1, 'El bloque está vacío').max(4000), kind: z.enum(['heading', 'text']) })
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const funnel = await queryOne<{ brief: string | null }>(`select brief from funnels where id = $1`, [funnelId])
  try {
    const text = await rewriteText({
      current: parsed.data.current,
      kind: parsed.data.kind,
      brief: funnel?.brief ?? null,
    })
    return { text }
  } catch (err) {
    return { error: `La IA no pudo reescribir el texto (${(err as Error).message})` }
  }
}

export async function renameFunnel(
  id: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  await query(`update funnels set name = $1, updated_at = now() where id = $2`, [parsed.data, id])
  revalidatePath('/funnels')
  revalidatePath(`/funnels/${id}`)
  return { success: true }
}

export async function setFunnelStatus(
  id: string,
  status: FunnelStatus
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.enum(['draft', 'published']).safeParse(status)
  if (!parsed.success) return { error: 'Estado inválido' }
  if (parsed.data === 'published') {
    const steps = await queryOne<{ n: number }>(
      `select count(*)::int as n from funnel_steps where funnel_id = $1`,
      [id]
    )
    if (!steps || steps.n === 0) return { error: 'Añade al menos un paso antes de publicar' }
  }
  await query(`update funnels set status = $1, updated_at = now() where id = $2`, [parsed.data, id])
  revalidatePath('/funnels')
  revalidatePath(`/funnels/${id}`)
  return { success: true }
}

export async function deleteFunnel(id: string): Promise<{ success?: boolean; error?: string }> {
  await query(`delete from funnels where id = $1`, [id])
  revalidatePath('/funnels')
  return { success: true }
}

// ─── Pasos ───────────────────────────────────────────────────────────────────

/** Crea un paso al final del funnel con su variante A vacía. */
export async function createStep(
  funnelId: string,
  name: string
): Promise<{ id?: string; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }

  const base = slugify(parsed.data) || 'paso'
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    try {
      const row = await queryOne<{ id: string }>(
        `insert into funnel_steps (funnel_id, slug, name, position)
         values ($1, $2, $3, coalesce((select max(position) + 1 from funnel_steps where funnel_id = $1), 0))
         returning id`,
        [funnelId, slug, parsed.data]
      )
      await query(`insert into funnel_step_variants (step_id, variant_key, design) values ($1, 'A', $2)`, [
        row!.id,
        JSON.stringify(defaultPageDesign()),
      ])
      await query(`update funnels set updated_at = now() where id = $1`, [funnelId])
      revalidatePath(`/funnels/${funnelId}`)
      return { id: row!.id }
    } catch (err) {
      if (!isUniqueViolation(err)) return { error: (err as Error).message }
    }
  }
  return { error: 'Ya existen varios pasos con ese nombre: usa otro' }
}

export async function renameStep(
  stepId: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  const row = await queryOne<{ funnel_id: string }>(
    `update funnel_steps set name = $1, updated_at = now() where id = $2 returning funnel_id`,
    [parsed.data, stepId]
  )
  if (row) revalidatePath(`/funnels/${row.funnel_id}`)
  return { success: true }
}

export async function deleteStep(stepId: string): Promise<{ success?: boolean; error?: string }> {
  const row = await queryOne<{ funnel_id: string }>(
    `delete from funnel_steps where id = $1 returning funnel_id`,
    [stepId]
  )
  if (row) revalidatePath(`/funnels/${row.funnel_id}`)
  return { success: true }
}

// ─── Diseño de página (variantes) ───────────────────────────────────────────
// (esquema + saneado compartidos con sitios web en services/page-design-schema.ts)

/** Guarda el diseño de una variante de paso (autosave del editor). */
export async function saveStepDesign(
  variantId: string,
  design: PageDesign
): Promise<{ success?: boolean; error?: string }> {
  const parsed = pageDesignSchema.safeParse(design)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Diseño inválido' }
  if (JSON.stringify(parsed.data).length > 200_000) return { error: 'El diseño es demasiado grande' }
  const row = await queryOne<{ id: string }>(
    `update funnel_step_variants set design = $1, updated_at = now() where id = $2 returning id`,
    [JSON.stringify(normalizePageDesign(parsed.data)), variantId]
  )
  if (!row) return { error: 'Variante no encontrada' }
  return { success: true }
}

const seoSchema = z.object({
  seo_title: z.string().trim().max(160),
  seo_description: z.string().trim().max(300),
})

/** Guarda el título/descripción SEO del paso. */
export async function saveStepSeo(
  stepId: string,
  input: { seo_title: string; seo_description: string }
): Promise<{ success?: boolean; error?: string }> {
  const parsed = seoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  await query(
    `update funnel_steps set seo_title = $1, seo_description = $2, updated_at = now() where id = $3`,
    [parsed.data.seo_title || null, parsed.data.seo_description || null, stepId]
  )
  return { success: true }
}

// ─── Dominios propios ────────────────────────────────────────────────────────

/** Asocia un dominio propio al funnel (el alta DNS + EasyPanel es manual, ver DEPLOY.md). */
export async function addFunnelDomain(
  funnelId: string,
  hostname: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = hostnameSchema.safeParse(hostname.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dominio inválido' }
  // Un dominio no puede apuntar a la vez a un embudo y a un sitio web
  const taken = await queryOne<{ id: string }>(
    `select id from website_domains where hostname = $1`,
    [parsed.data]
  )
  if (taken) return { error: 'Ese dominio ya está asociado a un sitio web' }
  try {
    await query(`insert into funnel_domains (hostname, funnel_id) values ($1, $2)`, [
      parsed.data,
      funnelId,
    ])
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ese dominio ya está asociado a un embudo' }
    return { error: (err as Error).message }
  }
  revalidatePath(`/funnels/${funnelId}`)
  return { success: true }
}

export async function removeFunnelDomain(
  domainId: string
): Promise<{ success?: boolean; error?: string }> {
  const row = await queryOne<{ funnel_id: string }>(
    `delete from funnel_domains where id = $1 returning funnel_id`,
    [domainId]
  )
  if (row) revalidatePath(`/funnels/${row.funnel_id}`)
  return { success: true }
}

// ─── Test A/B ────────────────────────────────────────────────────────────────

/** Activa el test A/B de un paso: crea la variante B como copia editable de la A. */
export async function startAbTest(stepId: string): Promise<{ success?: boolean; error?: string }> {
  const step = await queryOne<{ id: string; funnel_id: string; ab_active: boolean }>(
    `select id, funnel_id, ab_active from funnel_steps where id = $1`,
    [stepId]
  )
  if (!step) return { error: 'Paso no encontrado' }
  if (step.ab_active) return { error: 'Este paso ya tiene un test A/B activo' }

  const a = await queryOne<{ design: unknown }>(
    `select design from funnel_step_variants where step_id = $1 and variant_key = 'A'`,
    [stepId]
  )
  if (!a) return { error: 'El paso no tiene diseño' }

  try {
    await query(`insert into funnel_step_variants (step_id, variant_key, design) values ($1, 'B', $2)`, [
      stepId,
      JSON.stringify(a.design),
    ])
  } catch (err) {
    if (!isUniqueViolation(err)) return { error: (err as Error).message }
    // había una B huérfana de un test anterior: se reutiliza
  }
  await query(`update funnel_steps set ab_active = true, updated_at = now() where id = $1`, [stepId])
  revalidatePath(`/funnels/${step.funnel_id}`)
  revalidatePath(`/funnels/${step.funnel_id}/steps/${stepId}`)
  return { success: true }
}

/**
 * Declara la variante ganadora: su diseño queda como variante A única y el
 * test se apaga. Los eventos históricos se conservan (FK set null).
 */
export async function declareAbWinner(
  stepId: string,
  winner: 'A' | 'B'
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.enum(['A', 'B']).safeParse(winner)
  if (!parsed.success) return { error: 'Variante inválida' }
  const step = await queryOne<{ id: string; funnel_id: string; ab_active: boolean }>(
    `select id, funnel_id, ab_active from funnel_steps where id = $1`,
    [stepId]
  )
  if (!step) return { error: 'Paso no encontrado' }
  if (!step.ab_active) return { error: 'Este paso no tiene un test A/B activo' }

  if (parsed.data === 'B') {
    const b = await queryOne<{ design: unknown }>(
      `select design from funnel_step_variants where step_id = $1 and variant_key = 'B'`,
      [stepId]
    )
    if (!b) return { error: 'La variante B no existe' }
    await query(
      `update funnel_step_variants set design = $1, updated_at = now() where step_id = $2 and variant_key = 'A'`,
      [JSON.stringify(b.design), stepId]
    )
  }
  await query(`delete from funnel_step_variants where step_id = $1 and variant_key = 'B'`, [stepId])
  await query(`update funnel_steps set ab_active = false, updated_at = now() where id = $1`, [stepId])
  revalidatePath(`/funnels/${step.funnel_id}`)
  revalidatePath(`/funnels/${step.funnel_id}/steps/${stepId}`)
  return { success: true }
}

/** Intercambia la posición del paso con su vecino (subir/bajar en el embudo). */
export async function moveStep(
  stepId: string,
  direction: 'up' | 'down'
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.enum(['up', 'down']).safeParse(direction)
  if (!parsed.success) return { error: 'Dirección inválida' }

  const step = await queryOne<{ id: string; funnel_id: string; position: number }>(
    `select id, funnel_id, position from funnel_steps where id = $1`,
    [stepId]
  )
  if (!step) return { error: 'Paso no encontrado' }

  const neighbor = await queryOne<{ id: string; position: number }>(
    parsed.data === 'up'
      ? `select id, position from funnel_steps where funnel_id = $1 and position < $2 order by position desc limit 1`
      : `select id, position from funnel_steps where funnel_id = $1 and position > $2 order by position asc limit 1`,
    [step.funnel_id, step.position]
  )
  if (!neighbor) return { success: true } // ya está en el extremo

  await query(`update funnel_steps set position = $1, updated_at = now() where id = $2`, [
    neighbor.position,
    step.id,
  ])
  await query(`update funnel_steps set position = $1, updated_at = now() where id = $2`, [
    step.position,
    neighbor.id,
  ])
  revalidatePath(`/funnels/${step.funnel_id}`)
  return { success: true }
}
