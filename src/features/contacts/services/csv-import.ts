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

// ── Brevo (PRP-019) ─────────────────────────────────────────────────────────

export type CsvFormat = 'ghl' | 'brevo'

/** Brevo exporta con ';' y columnas EMAIL + CONTACT ID / _BLOCKLISTED. Si no, se asume GHL. */
export function detectCsvFormat(content: string): CsvFormat {
  const header = content.replace(/^﻿/, '').split(/\r?\n/, 1)[0].toUpperCase()
  const cols = header.split(';').map((c) => c.trim())
  return cols.includes('EMAIL') && (cols.includes('CONTACT ID') || cols.includes('_BLOCKLISTED'))
    ? 'brevo'
    : 'ghl'
}

export type UnsubscribeReason = 'blocklisted' | 'not_subscribed'

export interface BrevoContactRow {
  email: string // minúsculas y sin espacios
  first_name: string | null
  last_name: string | null
  phone: string | null
  added_at: string | null // ISO
  unsubscribe: UnsubscribeReason | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ADDED_TIME de Brevo: dd-mm-yyyy (opcional HH:mm[:ss]). new Date() lo leería como mm-dd. */
function parseBrevoDate(value: string | undefined): string | null {
  const m = (value ?? '').trim().match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const [, dd, mm, yyyy, hh = '12', mi = '00', ss = '00'] = m
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** _BLOCKLISTED vacío, false, 0, no o [] = no bloqueado. */
function isBlocklisted(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()
  return v !== '' && !['false', '0', 'no', '[]'].includes(v)
}

/**
 * Parsea un export de Brevo. Fusiona emails repetidos dentro del fichero
 * (primer valor no vacío gana; una baja en cualquiera de las filas manda).
 */
export function parseBrevoCsv(content: string): {
  rows: BrevoContactRow[]
  discarded: number
  errors: string[]
} {
  const errors: string[] = []
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, '').trim().toUpperCase(),
  })
  for (const e of result.errors.slice(0, 5)) errors.push(`Fila ${e.row}: ${e.message}`)

  const hasSubscribedCol = result.meta.fields?.includes('_SUBSCRIBED') ?? false
  const byEmail = new Map<string, BrevoContactRow>()
  let discarded = 0

  for (const raw of result.data) {
    const email = (raw['EMAIL'] ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      discarded++
      continue
    }
    let unsubscribe: UnsubscribeReason | null = null
    if (isBlocklisted(raw['_BLOCKLISTED'])) unsubscribe = 'blocklisted'
    else if (hasSubscribedCol && !(raw['_SUBSCRIBED'] ?? '').toLowerCase().includes('email_marketing')) {
      unsubscribe = 'not_subscribed'
    }
    const row: BrevoContactRow = {
      email,
      first_name: clean(raw['NOMBRE']),
      last_name: clean(raw['APELLIDOS']),
      phone: clean(raw['SMS']) ?? clean(raw['WHATSAPP']) ?? clean(raw['LANDLINE_NUMBER']),
      added_at: parseBrevoDate(raw['ADDED_TIME']),
      unsubscribe,
    }
    const prev = byEmail.get(email)
    byEmail.set(
      email,
      prev
        ? {
            email,
            first_name: prev.first_name ?? row.first_name,
            last_name: prev.last_name ?? row.last_name,
            phone: prev.phone ?? row.phone,
            added_at: prev.added_at ?? row.added_at,
            unsubscribe: prev.unsubscribe === 'blocklisted' ? 'blocklisted' : (row.unsubscribe ?? prev.unsubscribe),
          }
        : row
    )
  }

  return { rows: Array.from(byEmail.values()), discarded, errors }
}
