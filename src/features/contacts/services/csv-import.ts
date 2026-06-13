import Papa from 'papaparse'
import type { ParsedContactRow } from '../types'

/** Columnas esperadas del export de GHL. */
interface GhlCsvRow {
  'Contact Id'?: string
  'First Name'?: string
  'Last Name'?: string
  'Phone'?: string
  'Email'?: string
  'Business Name'?: string
  'Created'?: string
  'Last Activity'?: string
  'Tags'?: string
}

function clean(value: string | undefined): string | null {
  const v = (value ?? '').trim()
  return v === '' ? null : v
}

/** Parsea una fecha tolerante: ISO o formato humano de GHL. Devuelve ISO o null. */
function parseDate(value: string | undefined): string | null {
  const v = (value ?? '').trim()
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Normaliza la columna Tags: separa por coma, recorta, dedup, descarta vacíos. */
function parseTags(value: string | undefined): string[] {
  const v = (value ?? '').trim()
  if (!v) return []
  const tags = v
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return Array.from(new Set(tags))
}

/**
 * Parsea el contenido de un CSV de GHL en filas normalizadas.
 * Usa un parser CSV real (papaparse) porque los tags llevan comas internas.
 */
export function parseGhlCsv(content: string): {
  rows: ParsedContactRow[]
  errors: string[]
} {
  const errors: string[] = []
  const result = Papa.parse<GhlCsvRow>(content, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    for (const e of result.errors.slice(0, 5)) {
      errors.push(`Fila ${e.row}: ${e.message}`)
    }
  }

  const rows: ParsedContactRow[] = []
  for (const raw of result.data) {
    const ghlId = clean(raw['Contact Id'])
    const firstName = clean(raw['First Name'])
    const lastName = clean(raw['Last Name'])
    const email = clean(raw['Email'])
    const phone = clean(raw['Phone'])

    // Descarta filas totalmente vacías
    if (!ghlId && !firstName && !lastName && !email && !phone) continue

    rows.push({
      ghl_contact_id: ghlId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      business_name: clean(raw['Business Name']),
      tags: parseTags(raw['Tags']),
      last_activity_at: parseDate(raw['Last Activity']),
    })
  }

  return { rows, errors }
}
