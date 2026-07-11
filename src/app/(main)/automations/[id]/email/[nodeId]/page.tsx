import { notFound } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { listTemplates } from '@/features/marketing/services/queries'
import { listForms } from '@/features/automations/services/queries'
import { AutomationEmailDesigner } from '@/features/automations/components/AutomationEmailDesigner'
import type { AutomationNode } from '@/types/database'

/** Diseñador visual del email de un paso "Enviar email" (PRP-013). */
export default async function AutomationEmailPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>
}) {
  const { id, nodeId } = await params
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(nodeId)) notFound()

  const [node, templates, forms] = await Promise.all([
    queryOne<AutomationNode & { automation_name: string }>(
      `select n.*, a.name as automation_name
       from automation_nodes n
       join automations a on a.id = n.automation_id
       where n.id = $1 and n.automation_id = $2 and n.type = 'send_email'`,
      [nodeId, id]
    ),
    listTemplates(),
    listForms(),
  ])
  if (!node) notFound()

  return (
    <AutomationEmailDesigner
      automationId={id}
      automationName={node.automation_name}
      node={node}
      templates={templates.map((t) => ({ id: t.id, name: t.name, design: t.design }))}
      forms={forms}
    />
  )
}
