import { query, queryOne } from '@/lib/db'
import { hydrateForm } from './schema'
import type { Form, FormStatus, FormSubmission } from '@/types/database'

interface RawForm {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  schema: unknown
  styles: unknown
  settings: unknown
  created_at: string
  updated_at: string
}

const COLS =
  'id, slug, name, description, status, schema, styles, settings, created_at, updated_at'

export interface FormListItem {
  id: string
  name: string
  slug: string
  status: FormStatus
  updated_at: string
  submissions: number
  views: number
}

export async function listForms(): Promise<FormListItem[]> {
  return query<FormListItem>(
    `select f.id, f.name, f.slug, f.status, f.updated_at,
            count(distinct s.id)::int as submissions,
            count(distinct e.id) filter (where e.type = 'view')::int as views
     from forms f
     left join form_submissions s on s.form_id = f.id
     left join form_events e on e.form_id = f.id
     group by f.id
     order by f.updated_at desc`
  )
}

export async function getForm(id: string): Promise<Form | null> {
  const row = await queryOne<RawForm>(`select ${COLS} from forms where id = $1`, [id])
  return row ? hydrateForm(row) : null
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const row = await queryOne<RawForm>(`select ${COLS} from forms where slug = $1`, [slug])
  return row ? hydrateForm(row) : null
}

export async function listSubmissions(formId: string, limit = 200): Promise<FormSubmission[]> {
  return query<FormSubmission>(
    `select id, form_id, contact_id, data, visitor_id, created_at
     from form_submissions where form_id = $1
     order by created_at desc limit $2`,
    [formId, limit]
  )
}

export async function countSubmissions(formId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `select count(*)::int as n from form_submissions where form_id = $1`,
    [formId]
  )
  return row?.n ?? 0
}

/** IDs de automatizaciones cuyo disparador `form_submitted` apunta a este form. */
export async function getFormAutomationLinks(formId: string): Promise<string[]> {
  const rows = await query<{ automation_id: string }>(
    `select distinct automation_id from automation_trigger_defs
     where type = 'form_submitted' and config->>'form_id' = $1`,
    [formId]
  )
  return rows.map((r) => r.automation_id)
}
