import type { Contact, ContactActivity, ContactActivityType } from '@/types/database'

export type { Contact, ContactActivity, ContactActivityType }

/** Fila parseada y normalizada desde el CSV de GHL, lista para upsert. */
export interface ParsedContactRow {
  ghl_contact_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  business_name: string | null
  tags: string[]
  last_activity_at: string | null
}

/** Resultado del preview de importación. */
export interface ImportPreview {
  total: number
  newCount: number
  updateCount: number
  errors: string[]
  rows: ParsedContactRow[]
}
