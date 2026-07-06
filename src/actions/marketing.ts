'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { getResend, EMAIL_FROM, EMAIL_ADMIN } from '@/lib/email/client'
import { renderEmailHtml, applyMergeTags, extractDesignUrls } from '@/features/marketing/services/render'
import {
  countAudience,
  materializeRecipients,
  processCampaignBatch,
} from '@/features/marketing/services/campaign-engine'
import {
  columnCount,
  defaultDesign,
  designIsEmpty,
  migrateDesign,
} from '@/features/marketing/services/design'
import { sanitizeInlineHtml, sanitizeRawHtml } from '@/features/marketing/services/sanitize'
import type { CampaignAudience, EmailCampaign, EmailDesign } from '@/types/database'

const blockSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum([
    'header', 'text', 'image', 'button', 'divider', 'spacer', 'footer',
    'social', 'video', 'form', 'html',
  ]),
  config: z.object({
    logo_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    title: z.string().max(200).optional(),
    text: z.string().max(10000).optional(),
    html: z.string().max(20000).optional(),
    size: z.enum(['normal', 'title', 'subtitle']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    image_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    alt: z.string().max(300).optional(),
    link_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    label: z.string().max(200).optional(),
    url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    height: z.number().int().min(4).max(160).optional(),
    footer_text: z.string().max(2000).optional(),
    networks: z
      .array(
        z.object({
          network: z.enum(['facebook', 'instagram', 'x', 'youtube', 'linkedin', 'tiktok', 'whatsapp']),
          url: z.string().trim().url().max(1000).or(z.literal('')),
        })
      )
      .max(7)
      .optional(),
    video_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    thumbnail_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    form_id: z.string().uuid().optional(),
  }),
})

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')

const sectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    layout: z.enum(['1', '2', '3', '4', '1/3:2/3', '2/3:1/3', '1/4:3/4', '3/4:1/4']),
    config: z.object({
      background_color: hexColor.optional(),
      padding: z.number().int().min(0).max(80).optional(),
    }),
    columns: z.array(z.array(blockSchema).max(30)).min(1).max(4),
  })
  .refine((s) => s.columns.length === columnCount(s.layout), {
    message: 'Las columnas no cuadran con el diseño de la sección',
  })

const designSchema = z.object({
  version: z.literal(2),
  styles: z.object({ background_color: hexColor, button_color: hexColor }),
  sections: z.array(sectionSchema).max(20, 'El email no puede tener más de 20 secciones'),
})

/** Limpia strings vacíos, y SANEA el HTML de usuario (texto con formato y bloque código). */
function normalizeDesign(design: z.infer<typeof designSchema>): EmailDesign {
  return {
    ...design,
    sections: design.sections.map((s) => ({
      ...s,
      columns: s.columns.map((col) =>
        col.map((b) => {
          const config = Object.fromEntries(
            Object.entries(b.config).filter(([, v]) => v !== '' && v !== undefined)
          ) as typeof b.config
          if (typeof config.html === 'string') {
            config.html =
              b.type === 'html' ? sanitizeRawHtml(config.html) : sanitizeInlineHtml(config.html)
          }
          if (config.networks) config.networks = config.networks.filter((n) => n.url !== '')
          return { ...b, config }
        })
      ),
    })),
  }
}

export async function createCampaign(): Promise<{ id?: string; error?: string }> {
  try {
    const row = await queryOne<{ id: string }>(
      `insert into email_campaigns (name, subject, design) values ($1, $2, $3) returning id`,
      ['Campaña sin título', '', JSON.stringify(defaultDesign())]
    )
    revalidatePath('/marketing')
    return { id: row!.id }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function renameCampaign(
  id: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.string().trim().min(1, 'El nombre es obligatorio').max(160).safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  await query(`update email_campaigns set name = $1, updated_at = now() where id = $2`, [
    parsed.data,
    id,
  ])
  revalidatePath('/marketing')
  return { success: true }
}

const saveDesignSchema = z.object({
  subject: z.string().max(300),
  design: designSchema,
})

export async function saveCampaignDesign(
  id: string,
  input: { subject: string; design: EmailDesign }
): Promise<{ success?: boolean; error?: string }> {
  const parsed = saveDesignSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Diseño inválido' }
  if (JSON.stringify(parsed.data.design).length > 100_000)
    return { error: 'El diseño es demasiado grande' }
  const res = await query(
    `update email_campaigns set subject = $1, design = $2, updated_at = now()
     where id = $3 and status in ('draft', 'scheduled') returning id`,
    [parsed.data.subject, JSON.stringify(normalizeDesign(parsed.data.design)), id]
  )
  if (res.length === 0) {
    const c = await queryOne<{ status: string }>(`select status from email_campaigns where id = $1`, [id])
    if (c) return { error: 'La campaña ya se envió: el diseño no se puede modificar' }
    return { error: 'Campaña no encontrada' }
  }
  return { success: true }
}

export async function deleteCampaign(id: string): Promise<{ success?: boolean; error?: string }> {
  await query(`delete from email_campaigns where id = $1`, [id])
  revalidatePath('/marketing')
  return { success: true }
}

// ─── Audiencia y envío ───────────────────────────────────────────────────────

const audienceSchema = z.object({
  type: z.enum(['all', 'tags']),
  tags: z.array(z.string().min(1).max(100)).max(50).optional(),
})

export async function countCampaignAudience(
  audience: CampaignAudience
): Promise<{ count?: number; error?: string }> {
  const parsed = audienceSchema.safeParse(audience)
  if (!parsed.success) return { error: 'Audiencia inválida' }
  if (parsed.data.type === 'tags' && (!parsed.data.tags || parsed.data.tags.length === 0))
    return { count: 0 }
  return { count: await countAudience(parsed.data) }
}

const sendSchema = z.object({
  audience: audienceSchema,
  mode: z.enum(['now', 'schedule']),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
})

/**
 * Confirma el envío de la campaña: congela snapshot HTML + links, y
 * - now: materializa destinatarios y pasa a 'sending' (el motor envía).
 * - schedule: guarda fecha y pasa a 'scheduled' (el cron la disparará).
 */
export async function sendCampaign(
  id: string,
  input: { audience: CampaignAudience; mode: 'now' | 'schedule'; scheduledAt?: string }
): Promise<{ success?: boolean; recipients?: number; error?: string }> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { audience, mode, scheduledAt } = parsed.data

  if (audience.type === 'tags' && (!audience.tags || audience.tags.length === 0))
    return { error: 'Elige al menos una etiqueta' }
  if (mode === 'schedule') {
    if (!scheduledAt) return { error: 'Elige fecha y hora' }
    if (new Date(scheduledAt) <= new Date()) return { error: 'La fecha debe ser futura' }
  }

  const campaign = await queryOne<EmailCampaign>(`select * from email_campaigns where id = $1`, [id])
  if (!campaign) return { error: 'Campaña no encontrada' }
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled')
    return { error: 'Esta campaña ya se envió' }
  if (!campaign.subject.trim()) return { error: 'Escribe el asunto antes de enviar' }
  const design = migrateDesign(campaign.design)
  if (designIsEmpty(design)) return { error: 'El email está vacío' }

  // Congelar snapshot: HTML de referencia + links reales (validación del tracking)
  const html = renderEmailHtml({ design, merge: {}, unsubscribeUrl: null })
  const linkUrls = extractDesignUrls(design)

  if (mode === 'schedule') {
    await query(
      `update email_campaigns
       set html_snapshot = $1, link_urls = $2, audience = $3, status = 'scheduled',
           scheduled_at = $4, updated_at = now()
       where id = $5 and status in ('draft', 'scheduled')`,
      [html, linkUrls, JSON.stringify(audience), scheduledAt, id]
    )
    revalidatePath('/marketing')
    revalidatePath(`/marketing/campaigns/${id}`)
    return { success: true }
  }

  // Enviar ahora: transición atómica a 'sending' (dos clicks no materializan dos veces)
  const updated = await query(
    `update email_campaigns
     set html_snapshot = $1, link_urls = $2, audience = $3, status = 'sending',
         scheduled_at = null, started_at = now(), updated_at = now()
     where id = $4 and status in ('draft', 'scheduled') returning id`,
    [html, linkUrls, JSON.stringify(audience), id]
  )
  if (updated.length === 0) return { error: 'La campaña ya se está enviando' }

  const recipients = await materializeRecipients(id, audience)
  // Primer tramo inline: las campañas pequeñas salen sin esperar al cron
  await processCampaignBatch(id, 10)
  revalidatePath('/marketing')
  revalidatePath(`/marketing/campaigns/${id}`)
  return { success: true, recipients }
}

/** Cancela una campaña programada (vuelve a borrador). */
export async function cancelSchedule(id: string): Promise<{ success?: boolean; error?: string }> {
  const res = await query(
    `update email_campaigns set status = 'draft', scheduled_at = null, updated_at = now()
     where id = $1 and status = 'scheduled' returning id`,
    [id]
  )
  if (res.length === 0) return { error: 'La campaña ya no está programada' }
  revalidatePath('/marketing')
  revalidatePath(`/marketing/campaigns/${id}`)
  return { success: true }
}

// ─── Plantillas ──────────────────────────────────────────────────────────────

/** Guarda el diseño actual de una campaña como plantilla reutilizable. */
export async function saveAsTemplate(
  campaignId: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.string().trim().min(1, 'El nombre es obligatorio').max(160).safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  const campaign = await queryOne<EmailCampaign>(
    `select * from email_campaigns where id = $1`,
    [campaignId]
  )
  if (!campaign) return { error: 'Campaña no encontrada' }
  const design = migrateDesign(campaign.design)
  if (designIsEmpty(design)) return { error: 'El email está vacío' }
  await query(`insert into email_templates (name, design) values ($1, $2)`, [
    parsed.data,
    JSON.stringify(design),
  ])
  revalidatePath('/marketing')
  return { success: true }
}

/** Crea una campaña nueva a partir de una plantilla (diseño clonado). */
export async function createCampaignFromTemplate(
  templateId: string
): Promise<{ id?: string; error?: string }> {
  const template = await queryOne<{ name: string; design: EmailDesign }>(
    `select name, design from email_templates where id = $1`,
    [templateId]
  )
  if (!template) return { error: 'Plantilla no encontrada' }
  const row = await queryOne<{ id: string }>(
    `insert into email_campaigns (name, subject, design) values ($1, '', $2) returning id`,
    [template.name, JSON.stringify(template.design)]
  )
  revalidatePath('/marketing')
  return { id: row!.id }
}

export async function deleteTemplate(id: string): Promise<{ success?: boolean; error?: string }> {
  await query(`delete from email_templates where id = $1`, [id])
  revalidatePath('/marketing')
  return { success: true }
}

/** Baja pública (RGPD): marca el contacto y deja constancia en su timeline. Idempotente. */
export async function unsubscribeContact(
  token: string
): Promise<{ success?: boolean; error?: string }> {
  const parsed = z.string().regex(/^[0-9a-f]{32}$/).safeParse(token)
  if (!parsed.success) return { error: 'Enlace de baja inválido' }
  const row = await queryOne<{ id: string }>(
    `update contacts set unsubscribed_at = now(), updated_at = now()
     where unsubscribe_token = $1 and unsubscribed_at is null returning id`,
    [parsed.data]
  )
  if (row) {
    await query(
      `insert into contact_activities (contact_id, type, description)
       values ($1, 'note', 'Se dio de baja de los emails de marketing')`,
      [row.id]
    )
  }
  return { success: true }
}

/** Envía el email real de prueba al administrador (con datos de ejemplo en {{tags}}). */
export async function sendCampaignTest(id: string): Promise<{ success?: boolean; error?: string }> {
  const campaign = await queryOne<EmailCampaign>(`select * from email_campaigns where id = $1`, [id])
  if (!campaign) return { error: 'Campaña no encontrada' }

  const resend = getResend()
  if (!resend) return { error: 'El servicio de email no está configurado (falta RESEND_API_KEY)' }

  const admin =
    EMAIL_ADMIN ??
    (await queryOne<{ email: string }>(`select email from users order by created_at limit 1`))?.email
  if (!admin) return { error: 'No hay email de administrador configurado' }

  const merge = { nombre: '(Nombre)', apellido: '(Apellido)', email: admin }
  const html = renderEmailHtml({
    design: migrateDesign(campaign.design),
    merge,
    unsubscribeUrl: null, // en la prueba el link de baja no es real
  })
  const subject = applyMergeTags(campaign.subject || campaign.name, merge)

  try {
    const res = await resend.emails.send({
      from: EMAIL_FROM,
      to: admin,
      subject: `[Prueba] ${subject}`,
      html,
    })
    if (res.error) throw new Error(res.error.message)
    return { success: true }
  } catch (err) {
    return { error: `No se pudo enviar la prueba: ${(err as Error).message}` }
  }
}
