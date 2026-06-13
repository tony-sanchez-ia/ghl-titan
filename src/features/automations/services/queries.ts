import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Form, Automation, AutomationStep } from '@/types/database'

// ─── Formularios ─────────────────────────────────────────────────────────────
export interface FormListItem extends Form {
  submissionTriggers: number
}

export async function listForms(): Promise<Form[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getFormById(id: string): Promise<Form | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('forms').select('*').eq('id', id).single()
  return (data as Form) ?? null
}

/** [público] Formulario por slug (service-role). */
export async function getPublicFormBySlug(slug: string): Promise<Form | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('forms').select('*').eq('slug', slug).single()
  return (data as Form) ?? null
}

// ─── Automatizaciones ──────────────────────────────────────────────────────────
export interface AutomationListItem extends Automation {
  stepCount: number
}

export async function listAutomations(): Promise<AutomationListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automations')
    .select('*, automation_steps(count)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((a) => {
    const { automation_steps, ...rest } = a as Automation & {
      automation_steps: { count: number }[]
    }
    return { ...rest, stepCount: automation_steps?.[0]?.count ?? 0 }
  })
}

export interface AutomationWithDetail extends Automation {
  steps: AutomationStep[]
  formIds: string[]
}

export async function getAutomationForEdit(
  id: string
): Promise<AutomationWithDetail | null> {
  const supabase = await createClient()
  const { data: automation } = await supabase
    .from('automations')
    .select('*')
    .eq('id', id)
    .single()
  if (!automation) return null

  const [{ data: steps }, { data: triggers }] = await Promise.all([
    supabase.from('automation_steps').select('*').eq('automation_id', id).order('position'),
    supabase.from('automation_triggers').select('form_id').eq('automation_id', id),
  ])

  return {
    ...(automation as Automation),
    steps: (steps ?? []) as AutomationStep[],
    formIds: (triggers ?? []).map((t) => t.form_id),
  }
}

/** Automatización activa vinculada a un formulario (la primera). */
export async function getActiveAutomationForForm(
  formId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data: triggers } = await admin
    .from('automation_triggers')
    .select('automation_id')
    .eq('form_id', formId)
  if (!triggers || triggers.length === 0) return null

  const ids = triggers.map((t) => t.automation_id)
  const { data: active } = await admin
    .from('automations')
    .select('id')
    .in('id', ids)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return active?.id ?? null
}
