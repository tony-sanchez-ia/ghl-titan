import { z } from 'zod'
import { isInputField } from './schema'
import type { FormField, FormSchema } from '@/types/database'

const emailCheck = z.string().email()

export interface CleanSubmission {
  /** key → valor saneado (string | string[] | boolean) */
  data: Record<string, unknown>
  email: string
}

function required(f: FormField) {
  return { ok: false as const, error: `«${f.label}» es obligatorio` }
}

/**
 * Valida un envío contra el schema del formulario (server-side). Recorre los
 * campos que recogen datos, normaliza por tipo, comprueba requeridos y devuelve
 * el mapa limpio + el email (clave de dedup del contacto).
 */
export function validateSubmission(
  schema: FormSchema,
  raw: Record<string, unknown>
): { ok: true; result: CleanSubmission } | { ok: false; error: string } {
  const data: Record<string, unknown> = {}
  let email: string | null = null

  for (const f of schema.fields) {
    if (!isInputField(f.type)) continue
    const rawVal = raw[f.key]

    if (f.type === 'checkbox_group') {
      const arr = Array.isArray(rawVal)
        ? rawVal.map(String)
        : rawVal != null && rawVal !== ''
          ? [String(rawVal)]
          : []
      const allowed = new Set((f.options ?? []).map((o) => o.value))
      const clean = arr.filter((v) => allowed.has(v))
      if (f.required && clean.length === 0) return required(f)
      if (clean.length) data[f.key] = clean
      continue
    }

    if (f.type === 'consent') {
      const checked = rawVal === true || rawVal === 'true' || rawVal === 'on' || rawVal === '1'
      if (f.required && !checked) return { ok: false, error: `Debes aceptar: ${f.label}` }
      data[f.key] = checked
      continue
    }

    const val = typeof rawVal === 'string' ? rawVal.trim() : rawVal == null ? '' : String(rawVal)

    if (!val) {
      if (f.required) return required(f)
      continue
    }
    if (val.length > 5000) return { ok: false, error: `«${f.label}» es demasiado largo` }

    if (f.type === 'email' && !emailCheck.safeParse(val).success)
      return { ok: false, error: 'Email inválido' }
    if (f.type === 'number' && Number.isNaN(Number(val)))
      return { ok: false, error: `«${f.label}» debe ser un número` }
    if ((f.type === 'select' || f.type === 'radio') && f.options?.length) {
      const allowed = new Set(f.options.map((o) => o.value))
      if (!allowed.has(val)) return { ok: false, error: `Opción no válida en «${f.label}»` }
    }

    data[f.key] = val
    if (f.type === 'email' || f.key === 'email') email = val
  }

  if (!email) return { ok: false, error: 'El formulario necesita un email para poder contactarte.' }
  return { ok: true, result: { data, email } }
}
