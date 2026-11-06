'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { HEX_COLOR } from '@/features/instance/lib/brand-theme'
import { detectLogoMime, MAX_LOGO_BYTES } from '@/features/instance/lib/logo'

/**
 * Ajustes de la instancia (PRP-018): módulos activables + marca blanca.
 * Sin roles en el proyecto: cualquier usuario con sesión es admin.
 */

type Result = { success: true } | { error: string }

const modulesSchema = z.object({
  courses: z.boolean(),
  funnels: z.boolean(),
  websites: z.boolean(),
  forms: z.boolean(),
})

export async function updateModules(input: z.infer<typeof modulesSchema>): Promise<Result> {
  if (!(await getSession())) return { error: 'No autenticado' }
  const parsed = modulesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos no válidos' }

  const m = parsed.data
  await query(
    `update instance_settings
        set module_courses = $1, module_funnels = $2, module_websites = $3, module_forms = $4,
            updated_at = now()
      where id = true`,
    [m.courses, m.funnels, m.websites, m.forms]
  )
  revalidatePath('/', 'layout')
  return { success: true }
}

const brandSchema = z.object({
  brandName: z
    .string()
    .trim()
    .max(60, 'El nombre admite como máximo 60 caracteres')
    .transform((v) => v || null),
  accentColor: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || HEX_COLOR.test(v), 'Color no válido')
    .transform((v) => v || null),
})

/** Nombre y color. Vacío = volver al valor por defecto (GHL Titan / azul). */
export async function updateBrand(input: { brandName: string; accentColor: string }): Promise<Result> {
  if (!(await getSession())) return { error: 'No autenticado' }
  const parsed = brandSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }

  await query(
    `update instance_settings set brand_name = $1, accent_color = $2, updated_at = now() where id = true`,
    [parsed.data.brandName, parsed.data.accentColor]
  )
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function uploadLogo(formData: FormData): Promise<Result> {
  if (!(await getSession())) return { error: 'No autenticado' }
  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) return { error: 'Elige una imagen' }
  if (file.size > MAX_LOGO_BYTES) return { error: 'El logo pesa demasiado (máximo 500 KB)' }

  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = detectLogoMime(bytes)
  if (!mime) return { error: 'Formato no admitido. Usa PNG, JPG, WEBP o SVG' }

  await query(
    `update instance_settings
        set logo_data = $1, logo_mime = $2, logo_updated_at = now(), updated_at = now()
      where id = true`,
    [bytes, mime]
  )
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeLogo(): Promise<Result> {
  if (!(await getSession())) return { error: 'No autenticado' }
  await query(
    `update instance_settings
        set logo_data = null, logo_mime = null, logo_updated_at = null, updated_at = now()
      where id = true`
  )
  revalidatePath('/', 'layout')
  return { success: true }
}
