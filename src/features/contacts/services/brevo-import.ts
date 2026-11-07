import { query } from '@/lib/db'
import type { BrevoContactRow } from './csv-import'

const BATCH = 500

export interface BrevoImportResult {
  total: number
  newCount: number
  updateCount: number
  unsubscribedBlocklisted: number
  unsubscribedNotSubscribed: number
}

/**
 * Importa contactos de Brevo por lotes (set-based: 3 queries por lote, no una por fila).
 * - Dedup por lower(email) contra el CRM.
 * - Nuevos: todos los datos + fecha de alta original + activity 'imported'.
 * - Existentes: solo se rellenan campos VACÍOS, se suman las etiquetas y la baja (nunca se revierte).
 * No dispara automatizaciones de "etiqueta añadida": importar no debe mandar emails en masa.
 */
export async function importBrevoContacts(rows: BrevoContactRow[], tags: string[]): Promise<BrevoImportResult> {
  const result: BrevoImportResult = {
    total: rows.length,
    newCount: 0,
    updateCount: 0,
    unsubscribedBlocklisted: rows.filter((r) => r.unsubscribe === 'blocklisted').length,
    unsubscribedNotSubscribed: rows.filter((r) => r.unsubscribe === 'not_subscribed').length,
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({ ...r, unsubscribe: r.unsubscribe !== null }))
    const existing = await query<{ email: string }>(
      'select distinct lower(email) as email from contacts where lower(email) = any($1)',
      [batch.map((r) => r.email)]
    )
    const existingSet = new Set(existing.map((e) => e.email))
    const fresh = batch.filter((r) => !existingSet.has(r.email))
    const known = batch.filter((r) => existingSet.has(r.email))

    if (fresh.length > 0) {
      await query(
        `with ins as (
           insert into contacts (email, first_name, last_name, phone, tags, source, created_at, unsubscribed_at)
           select x.email, x.first_name, x.last_name, x.phone, $2::text[], 'brevo_import',
                  coalesce(x.added_at, now()), case when x.unsubscribe then now() end
           from jsonb_to_recordset($1::jsonb)
             as x(email text, first_name text, last_name text, phone text, added_at timestamptz, unsubscribe boolean)
           returning id
         )
         insert into contact_activities (contact_id, type, description, metadata)
         select id, 'imported', 'Importado desde Brevo', '{}' from ins`,
        [JSON.stringify(fresh), tags]
      )
      result.newCount += fresh.length
    }

    if (known.length > 0) {
      await query(
        `update contacts c set
           first_name = coalesce(nullif(c.first_name, ''), x.first_name),
           last_name = coalesce(nullif(c.last_name, ''), x.last_name),
           phone = coalesce(nullif(c.phone, ''), x.phone),
           tags = array(select distinct t from unnest(coalesce(c.tags, '{}') || $2::text[]) t),
           unsubscribed_at = coalesce(c.unsubscribed_at, case when x.unsubscribe then now() end),
           updated_at = now()
         from jsonb_to_recordset($1::jsonb)
           as x(email text, first_name text, last_name text, phone text, unsubscribe boolean)
         where lower(c.email) = x.email`,
        [JSON.stringify(known), tags]
      )
      result.updateCount += known.length
    }
  }

  return result
}
