import { z } from 'zod'
import { columnCount } from '@/shared/lib/section-layout'
import { sanitizeInlineHtml, sanitizeRawHtml } from '@/shared/lib/sanitize'
import type { PageDesign } from '@/types/database'

/**
 * Validación + saneado server-side del diseño de página (PageDesign).
 * Lo comparten las actions de funnels (variantes de paso) y de sitios web (páginas).
 */

const pageBlockSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['heading', 'text', 'image', 'button', 'video', 'form', 'html', 'divider', 'spacer']),
  config: z.object({
    text: z.string().max(500).optional(),
    html: z.string().max(20000).optional(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    image_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    alt: z.string().max(300).optional(),
    link_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    label: z.string().max(200).optional(),
    url: z
      .string()
      .trim()
      .max(1000)
      .refine((u) => u === '' || /^https?:\/\//i.test(u) || u.startsWith('/'), {
        message: 'El enlace debe ser https://… o una ruta que empiece por /',
      })
      .optional(),
    video_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    form_id: z.string().uuid().optional(),
    form_slug: z.string().max(100).optional(),
    height: z.number().int().min(4).max(240).optional(),
  }),
})

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')

const pageSectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    layout: z.enum(['1', '2', '3', '4', '1/3:2/3', '2/3:1/3', '1/4:3/4', '3/4:1/4']),
    config: z.object({
      background_color: hexColor.optional(),
      padding: z.number().int().min(0).max(160).optional(),
    }),
    columns: z.array(z.array(pageBlockSchema).max(30)).min(1).max(4),
  })
  .refine((s) => s.columns.length === columnCount(s.layout), {
    message: 'Las columnas no cuadran con el diseño de la sección',
  })

export const pageDesignSchema = z.object({
  version: z.literal(1),
  styles: z.object({ background_color: hexColor, button_color: hexColor, text_color: hexColor }),
  sections: z.array(pageSectionSchema).max(30, 'La página no puede tener más de 30 secciones'),
})

/** Limpia strings vacíos y SANEA el HTML de usuario (texto con formato y bloque código). */
export function normalizePageDesign(design: z.infer<typeof pageDesignSchema>): PageDesign {
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
          return { ...b, config }
        })
      ),
    })),
  }
}

/** Valida el hostname de un dominio propio (sin protocolo ni rutas). */
export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    'Escribe solo el dominio, sin https:// ni barras (p. ej. ofertas.tunegocio.com)'
  )
