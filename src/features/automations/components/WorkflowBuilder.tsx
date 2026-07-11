'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Mail, Clock, Tag, StickyNote, Split, Zap, FileInput, Calendar as CalendarIcon,
  MousePointerClick, X, Paintbrush,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  renameAutomation, setAutomationStatus, deleteAutomation,
  addTrigger, deleteTrigger, addNode, updateNode, deleteNode,
} from '@/actions/automations'
import type {
  AutomationNode, Calendar, Form, NodeBranch, NodeType, TriggerType,
} from '@/types/database'
import type { WorkflowForEdit } from '../services/queries'

const NODE_META: Record<NodeType, { label: string; icon: typeof Mail }> = {
  send_email: { label: 'Enviar email', icon: Mail },
  wait: { label: 'Esperar', icon: Clock },
  add_tag: { label: 'Añadir etiqueta', icon: Tag },
  add_note: { label: 'Añadir nota', icon: StickyNote },
  branch_email_click: { label: '¿Hizo click en el email?', icon: Split },
}

const unitLabel = (n: number, unit?: string) => `${n} ${unit === 'hours' ? (n === 1 ? 'hora' : 'horas') : n === 1 ? 'día' : 'días'}`

export function WorkflowBuilder({
  workflow, forms, calendars,
}: {
  workflow: WorkflowForEdit
  forms: Form[]
  calendars: Calendar[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(workflow.name)
  const active = workflow.status === 'active'

  async function run(fn: () => Promise<{ error?: string } | void>) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res && 'error' in res && res.error) alert(res.error)
    router.refresh()
  }

  async function onDelete() {
    if (!confirm('¿Borrar este flujo de trabajo?')) return
    setBusy(true)
    const res = await deleteAutomation(workflow.id)
    if (res?.error) { setBusy(false); alert(res.error); return }
    router.push('/automations')
  }

  const chainOf = (parentId: string | null, branch: NodeBranch | null) =>
    workflow.nodes
      .filter((n) => n.parent_node_id === parentId && n.branch === branch)
      .sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== workflow.name && run(() => renameAutomation(workflow.id, name))}
          className="text-2xl font-bold bg-transparent outline-none focus:bg-bg rounded px-1"
        />
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
            {active ? 'Activa' : 'Borrador'}
          </span>
          <button onClick={() => run(() => setAutomationStatus(workflow.id, active ? 'draft' : 'active'))} disabled={busy} className={`${ui.button} px-3 py-2 text-sm`}>
            {active ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={onDelete} disabled={busy} className={`${ui.button} px-3 py-2 text-sm text-red-600`}><Trash2 size={16} /></button>
        </div>
      </div>

      {!active && (
        <div className={`${ui.card} p-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900`}>
          El flujo está en borrador: no inscribe contactos ni envía emails hasta que lo actives.
        </div>
      )}

      {/* Lienzo vertical */}
      <div className="max-w-2xl mx-auto">
        <TriggersCard workflow={workflow} forms={forms} calendars={calendars} busy={busy} run={run} />
        <Chain
          workflow={workflow}
          parentId={null}
          branch={null}
          nodes={chainOf(null, null)}
          chainOf={chainOf}
          busy={busy}
          run={run}
        />
        <div className="flex justify-center">
          <div className={`${ui.card} px-4 py-2 text-sm text-muted`}>Fin del flujo</div>
        </div>
      </div>
    </div>
  )
}

// ─── Disparadores ─────────────────────────────────────────────────────────────

function TriggersCard({
  workflow, forms, calendars, busy, run,
}: {
  workflow: WorkflowForEdit
  forms: Form[]
  calendars: Calendar[]
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
}) {
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<TriggerType>('form_submitted')
  const [formId, setFormId] = useState(forms[0]?.id ?? '')
  const [calendarId, setCalendarId] = useState<string>('')
  const [tag, setTag] = useState('')

  function describe(t: WorkflowForEdit['triggers'][number]): { icon: typeof Zap; text: string } {
    if (t.type === 'form_submitted') {
      const f = forms.find((x) => x.id === t.config.form_id)
      return { icon: FileInput, text: `Formulario enviado: ${f?.name ?? '(borrado)'}` }
    }
    if (t.type === 'booking_created') {
      const c = calendars.find((x) => x.id === t.config.calendar_id)
      return { icon: CalendarIcon, text: `Cita reservada: ${t.config.calendar_id ? c?.name ?? '(borrado)' : 'cualquier calendario'}` }
    }
    return { icon: Tag, text: `Etiqueta añadida: ${t.config.tag}` }
  }

  function submit() {
    run(() =>
      addTrigger(workflow.id, {
        type,
        ...(type === 'form_submitted' ? { form_id: formId } : {}),
        ...(type === 'booking_created' ? { calendar_id: calendarId || null } : {}),
        ...(type === 'tag_added' ? { tag } : {}),
      })
    )
    setAdding(false)
    setTag('')
  }

  return (
    <div className={`${ui.card} p-5 border-primary/40`}>
      <h2 className="font-semibold flex items-center gap-2 text-primary"><Zap size={17} /> Cuándo empieza</h2>

      {workflow.triggers.length === 0 && !adding && (
        <p className="text-sm text-muted mt-2">Sin disparadores: nadie entrará en este flujo todavía.</p>
      )}

      <div className="mt-3 space-y-2">
        {workflow.triggers.map((t) => {
          const { icon: Icon, text } = describe(t)
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2"><Icon size={15} className="text-muted" /> {text}</span>
              <button onClick={() => run(() => deleteTrigger(t.id, workflow.id))} disabled={busy} aria-label="Quitar disparador" className="text-muted hover:text-red-600 p-1"><X size={14} /></button>
            </div>
          )
        })}
      </div>

      {adding ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <select value={type} onChange={(e) => setType(e.target.value as TriggerType)} className={ui.input}>
            <option value="form_submitted">Formulario enviado</option>
            <option value="booking_created">Cita reservada</option>
            <option value="tag_added">Etiqueta añadida</option>
          </select>
          {type === 'form_submitted' && (
            <select value={formId} onChange={(e) => setFormId(e.target.value)} className={ui.input}>
              {forms.length === 0 && <option value="">No hay formularios — crea uno primero</option>}
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {type === 'booking_created' && (
            <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className={ui.input}>
              <option value="">Cualquier calendario</option>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {type === 'tag_added' && (
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nombre de la etiqueta (ej: interesado)" className={ui.input} />
          )}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy || (type === 'form_submitted' && !formId) || (type === 'tag_added' && !tag.trim())} className={`${ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}>Añadir</button>
            <button onClick={() => setAdding(false)} className={`${ui.button} px-3 py-2 text-sm`}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} disabled={busy} className={`${ui.button} px-3 py-1.5 text-sm mt-3`}>
          <Plus size={15} /> Añadir disparador
        </button>
      )}
    </div>
  )
}

// ─── Cadena de nodos (recursiva para las ramas) ──────────────────────────────

function Chain({
  workflow, parentId, branch, nodes, chainOf, busy, run,
}: {
  workflow: WorkflowForEdit
  parentId: string | null
  branch: NodeBranch | null
  nodes: AutomationNode[]
  chainOf: (parentId: string | null, branch: NodeBranch | null) => AutomationNode[]
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
}) {
  return (
    <div>
      <AddNodeButton workflow={workflow} parentId={parentId} branch={branch} afterNodeId={null} busy={busy} run={run} />
      {nodes.map((node) => (
        <div key={node.id}>
          <NodeCard workflow={workflow} node={node} chainOf={chainOf} busy={busy} run={run} />
          <AddNodeButton workflow={workflow} parentId={parentId} branch={branch} afterNodeId={node.id} busy={busy} run={run} />
        </div>
      ))}
    </div>
  )
}

function AddNodeButton({
  workflow, parentId, branch, afterNodeId, busy, run,
}: {
  workflow: WorkflowForEdit
  parentId: string | null
  branch: NodeBranch | null
  afterNodeId: string | null
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
}) {
  const [open, setOpen] = useState(false)

  function add(type: NodeType) {
    setOpen(false)
    run(() => addNode(workflow.id, { type, parentNodeId: parentId, branch, afterNodeId }))
  }

  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-4 bg-border" />
      {open ? (
        <div className={`${ui.card} p-2 grid grid-cols-1 gap-1 w-56 z-10`}>
          {(Object.keys(NODE_META) as NodeType[]).map((t) => {
            const { label, icon: Icon } = NODE_META[t]
            return (
              <button key={t} onClick={() => add(t)} disabled={busy} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-bg text-left">
                <Icon size={15} className="text-primary" /> {label}
              </button>
            )
          })}
          <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-fg py-1">Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} disabled={busy} aria-label="Añadir paso" className="w-7 h-7 rounded-full border border-border bg-card text-muted hover:text-primary hover:border-primary flex items-center justify-center transition-colors">
          <Plus size={15} />
        </button>
      )}
      <div className="w-px h-4 bg-border" />
    </div>
  )
}

// ─── Tarjeta de nodo ─────────────────────────────────────────────────────────

function NodeCard({
  workflow, node, chainOf, busy, run,
}: {
  workflow: WorkflowForEdit
  node: AutomationNode
  chainOf: (parentId: string | null, branch: NodeBranch | null) => AutomationNode[]
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
}) {
  const [editing, setEditing] = useState(false)
  const { label, icon: Icon } = NODE_META[node.type] ?? { label: node.type, icon: StickyNote }
  const stats = workflow.emailStats.find((s) => s.node_id === node.id)

  function summary(): string {
    const c = node.config
    switch (node.type) {
      case 'send_email':
        return `${c.subject || '(sin asunto)'}${c.email_mode === 'designed' ? ' · diseñado' : ''}`
      case 'wait': return unitLabel(c.delay_value ?? 0, c.delay_unit)
      case 'add_tag': return c.tag ? `"${c.tag}"` : '(sin etiqueta)'
      case 'add_note': return c.note || '(sin texto)'
      case 'branch_email_click': return `espera el click ${unitLabel(c.wait_value ?? 2, c.wait_unit)}`
      default: return ''
    }
  }

  function onDeleteNode() {
    const hasChildren = node.type === 'branch_email_click' &&
      (chainOf(node.id, 'yes').length > 0 || chainOf(node.id, 'no').length > 0)
    if (!confirm(hasChildren ? '¿Borrar la rama y TODOS sus pasos?' : '¿Borrar este paso?')) return
    run(() => deleteNode(node.id, workflow.id))
  }

  return (
    <div>
      <div className={`${ui.card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-3 text-left flex-1">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon size={17} /></span>
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-sm text-muted truncate max-w-[24rem]">{summary()}</span>
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {node.type === 'send_email' && stats && (
              <span className="text-xs text-muted inline-flex items-center gap-1 mr-1" title="Enviados · Clicks">
                <Mail size={12} /> {stats.sent} <MousePointerClick size={12} /> {stats.clicked}
              </span>
            )}
            <button onClick={onDeleteNode} disabled={busy} aria-label="Borrar paso" className="text-muted hover:text-red-600 p-1"><Trash2 size={15} /></button>
          </div>
        </div>

        {editing && <NodeConfigForm node={node} workflowId={workflow.id} busy={busy} run={run} onDone={() => setEditing(false)} />}
      </div>

      {node.type === 'branch_email_click' && (
        <div className="grid grid-cols-2 gap-3 mt-1">
          {(['yes', 'no'] as NodeBranch[]).map((b) => (
            <div key={b} className="rounded-xl border border-dashed border-border p-2">
              <p className={`text-xs font-semibold text-center ${b === 'yes' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {b === 'yes' ? '✓ Hizo click' : '✗ No hizo click'}
              </p>
              <Chain
                workflow={workflow}
                parentId={node.id}
                branch={b}
                nodes={chainOf(node.id, b)}
                chainOf={chainOf}
                busy={busy}
                run={run}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NodeConfigForm({
  node, workflowId, busy, run, onDone,
}: {
  node: AutomationNode
  workflowId: string
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
  onDone: () => void
}) {
  const [config, setConfig] = useState({ ...node.config })
  const set = (k: string, v: unknown) => setConfig((c) => ({ ...c, [k]: v }))

  function save() {
    run(() => updateNode(node.id, workflowId, config))
    onDone()
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {node.type === 'send_email' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Asunto</label>
            <input value={config.subject ?? ''} onChange={(e) => set('subject', e.target.value)} className={`${ui.input}`} placeholder="Admite {{nombre}}, {{apellido}} y {{email}}" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de email</label>
            <div className="flex items-center rounded-lg border border-border overflow-hidden w-fit text-sm">
              <button
                type="button"
                onClick={() => set('email_mode', 'simple')}
                className={`px-3 py-2 ${(config.email_mode ?? 'simple') === 'simple' ? 'bg-primary-soft text-primary font-medium' : 'text-muted'}`}
              >
                Sencillo (texto)
              </button>
              <button
                type="button"
                onClick={() => set('email_mode', 'designed')}
                className={`px-3 py-2 ${config.email_mode === 'designed' ? 'bg-primary-soft text-primary font-medium' : 'text-muted'}`}
              >
                Diseñado (visual)
              </button>
            </div>
          </div>
          {config.email_mode === 'designed' ? (
            <div className="rounded-lg border border-border bg-bg p-3 space-y-2">
              <p className="text-sm text-muted">
                {config.design
                  ? 'Este paso envía un email con diseño visual.'
                  : 'Todavía no hay diseño: guarda el paso y ábrelo en el diseñador.'}
              </p>
              <Link
                href={`/automations/${workflowId}/email/${node.id}`}
                className={`${ui.buttonPrimary} px-3 py-2 text-sm inline-flex`}
              >
                <Paintbrush size={15} /> Abrir el diseñador
              </Link>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Mensaje</label>
              <textarea value={config.body ?? ''} onChange={(e) => set('body', e.target.value)} rows={5} className={ui.input} />
              <p className="text-xs text-muted mt-1">Los enlaces del mensaje se rastrean automáticamente (clicks).</p>
            </div>
          )}
        </>
      )}
      {(node.type === 'wait' || node.type === 'branch_email_click') && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">{node.type === 'wait' ? 'Esperar' : 'Esperar el click durante'}</span>
          <input
            type="number" min={node.type === 'wait' ? 0 : 1}
            value={(node.type === 'wait' ? config.delay_value : config.wait_value) ?? 1}
            onChange={(e) => set(node.type === 'wait' ? 'delay_value' : 'wait_value', Number(e.target.value))}
            className={`${ui.input} w-24`}
          />
          <select
            value={(node.type === 'wait' ? config.delay_unit : config.wait_unit) ?? 'days'}
            onChange={(e) => set(node.type === 'wait' ? 'delay_unit' : 'wait_unit', e.target.value)}
            className={`${ui.input} w-auto`}
          >
            <option value="days">días</option>
            <option value="hours">horas</option>
          </select>
        </div>
      )}
      {node.type === 'add_tag' && (
        <div>
          <label className="block text-sm font-medium mb-1">Etiqueta</label>
          <input value={config.tag ?? ''} onChange={(e) => set('tag', e.target.value)} placeholder="ej: frio" className={ui.input} />
        </div>
      )}
      {node.type === 'add_note' && (
        <div>
          <label className="block text-sm font-medium mb-1">Nota (se guarda en la ficha del contacto)</label>
          <textarea value={config.note ?? ''} onChange={(e) => set('note', e.target.value)} rows={3} className={ui.input} />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>Guardar</button>
        <button onClick={onDone} className={`${ui.button} px-4 py-2 text-sm`}>Cerrar</button>
      </div>
    </div>
  )
}
