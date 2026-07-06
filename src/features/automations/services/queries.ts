import { query, queryOne } from '@/lib/db'
import type {
  Form,
  Automation,
  AutomationNode,
  AutomationTriggerDef,
} from '@/types/database'

// ─── Formularios ─────────────────────────────────────────────────────────────
export async function listForms(): Promise<Form[]> {
  return query<Form>('select * from forms order by created_at desc')
}

export async function getFormById(id: string): Promise<Form | null> {
  return queryOne<Form>('select * from forms where id = $1', [id])
}

/** [público] Formulario por slug. */
export async function getPublicFormBySlug(slug: string): Promise<Form | null> {
  return queryOne<Form>('select * from forms where slug = $1', [slug])
}

// ─── Automatizaciones ──────────────────────────────────────────────────────────
export interface AutomationListItem extends Automation {
  nodeCount: number
  activeEnrollments: number
}

export async function listAutomations(): Promise<AutomationListItem[]> {
  const rows = await query<Automation & { node_count: string; active_enrollments: string }>(
    `select a.*,
       (select count(*) from automation_nodes n where n.automation_id = a.id) as node_count,
       (select count(*) from automation_enrollments e
         where e.automation_id = a.id and e.status in ('active','waiting_click')) as active_enrollments
     from automations a order by a.created_at desc`
  )
  return rows.map(({ node_count, active_enrollments, ...rest }) => ({
    ...rest,
    nodeCount: Number(node_count),
    activeEnrollments: Number(active_enrollments),
  }))
}

/** Métricas por nodo de email: enviados y clicks (para el builder). */
export interface NodeEmailStats {
  node_id: string
  sent: number
  clicked: number
}

export interface WorkflowForEdit extends Automation {
  triggers: AutomationTriggerDef[]
  nodes: AutomationNode[] // lista plana ordenada; el builder arma el árbol
  emailStats: NodeEmailStats[]
}

export async function getWorkflowForEdit(id: string): Promise<WorkflowForEdit | null> {
  const automation = await queryOne<Automation>('select * from automations where id = $1', [id])
  if (!automation) return null

  const [triggers, nodes, stats] = await Promise.all([
    query<AutomationTriggerDef>(
      'select * from automation_trigger_defs where automation_id = $1 order by created_at',
      [id]
    ),
    query<AutomationNode>(
      'select * from automation_nodes where automation_id = $1 order by parent_node_id nulls first, branch, position',
      [id]
    ),
    query<{ node_id: string; sent: string; clicked: string }>(
      `select node_id,
              count(*) filter (where status = 'sent') as sent,
              count(*) filter (where clicked_at is not null) as clicked
       from scheduled_emails
       where automation_id = $1 and node_id is not null
       group by node_id`,
      [id]
    ),
  ])

  return {
    ...automation,
    triggers,
    nodes,
    emailStats: stats.map((s) => ({
      node_id: s.node_id,
      sent: Number(s.sent),
      clicked: Number(s.clicked),
    })),
  }
}
