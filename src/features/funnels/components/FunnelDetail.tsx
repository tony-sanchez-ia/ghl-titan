'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Check,
  Paintbrush,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  X,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  createStep,
  deleteFunnel,
  deleteStep,
  moveStep,
  renameFunnel,
  renameStep,
  setFunnelStatus,
} from '@/actions/funnels'
import type { Funnel, FunnelStep } from '@/types/database'

function InlineRename({
  value,
  onSave,
}: {
  value: string
  onSave: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        className="text-muted hover:text-fg"
        title="Renombrar"
      >
        <Pencil size={15} />
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && draft.trim()) {
            await onSave(draft)
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`${ui.input} py-1 px-2 text-sm w-56`}
      />
      <button
        onClick={async () => {
          if (draft.trim()) {
            await onSave(draft)
            setEditing(false)
          }
        }}
        className="text-primary"
        title="Guardar"
      >
        <Check size={16} />
      </button>
      <button onClick={() => setEditing(false)} className="text-muted" title="Cancelar">
        <X size={16} />
      </button>
    </span>
  )
}

export function FunnelDetail({ funnel, steps }: { funnel: Funnel; steps: FunnelStep[] }) {
  const router = useRouter()
  const [newStepName, setNewStepName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ error?: string } | { id?: string; error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await action()
    if (res.error) setError(res.error)
    router.refresh()
    setBusy(false)
  }

  const published = funnel.status === 'published'

  return (
    <div className="space-y-6">
      <Link
        href="/funnels"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={15} /> Embudos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold">{funnel.name}</h1>
          <InlineRename value={funnel.name} onSave={async (n) => run(() => renameFunnel(funnel.id, n))} />
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              published
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-bg text-muted'
            }`}
          >
            {published ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/funnels/${funnel.id}/stats`} className={`${ui.button} px-3 py-2 text-sm`}>
            <BarChart3 size={15} /> Estadísticas
          </Link>
          <button
            onClick={() => run(() => setFunnelStatus(funnel.id, published ? 'draft' : 'published'))}
            disabled={busy}
            className={`${published ? ui.button : ui.buttonPrimary} px-3 py-2 text-sm`}
          >
            <Rocket size={15} /> {published ? 'Despublicar' : 'Publicar'}
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Borrar el embudo "${funnel.name}" con todos sus pasos y estadísticas?`))
                run(async () => {
                  const res = await deleteFunnel(funnel.id)
                  if (!res.error) router.push('/funnels')
                  return res
                })
            }}
            disabled={busy}
            className={`${ui.button} px-3 py-2 text-sm text-red-600`}
          >
            <Trash2 size={15} /> Borrar
          </button>
        </div>
      </div>

      <p className="text-sm text-muted -mt-3">
        Dirección pública: <span className="font-mono">/p/{funnel.slug}</span>
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={`${ui.card} divide-y divide-border`}>
        <div className="px-5 py-4">
          <h2 className="font-semibold">Pasos del embudo</h2>
          <p className="text-sm text-muted mt-0.5">
            El visitante recorre los pasos en orden: landing → oferta → gracias.
          </p>
        </div>

        {steps.map((s, i) => (
          <div key={s.id} className="px-5 py-3 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary text-xs font-semibold inline-flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/funnels/${funnel.id}/steps/${s.id}`}
                  className="font-medium truncate hover:text-primary"
                >
                  {s.name}
                </Link>
                <InlineRename value={s.name} onSave={async (n) => run(() => renameStep(s.id, n))} />
                {s.ab_active && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-soft text-primary uppercase tracking-wide shrink-0">
                    A/B
                  </span>
                )}
              </div>
              <p className="text-xs text-muted font-mono truncate">/{s.slug}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/funnels/${funnel.id}/steps/${s.id}`}
                className={`${ui.button} px-2.5 py-1.5 text-xs mr-1`}
              >
                <Paintbrush size={13} /> Diseñar
              </Link>
              <button
                onClick={() => run(() => moveStep(s.id, 'up'))}
                disabled={busy || i === 0}
                className="p-1.5 text-muted hover:text-fg disabled:opacity-30"
                title="Subir"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={() => run(() => moveStep(s.id, 'down'))}
                disabled={busy || i === steps.length - 1}
                className="p-1.5 text-muted hover:text-fg disabled:opacity-30"
                title="Bajar"
              >
                <ArrowDown size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Borrar el paso "${s.name}"?`)) run(() => deleteStep(s.id))
                }}
                disabled={busy}
                className="p-1.5 text-muted hover:text-red-600"
                title="Borrar paso"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        <div className="px-5 py-4 flex items-center gap-2">
          <input
            value={newStepName}
            onChange={(e) => setNewStepName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newStepName.trim()) {
                run(() => createStep(funnel.id, newStepName))
                setNewStepName('')
              }
            }}
            placeholder="Nombre del nuevo paso (p. ej., Oferta)"
            className={`${ui.input} max-w-sm`}
          />
          <button
            onClick={() => {
              run(() => createStep(funnel.id, newStepName))
              setNewStepName('')
            }}
            disabled={busy || !newStepName.trim()}
            className={`${ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}
          >
            <Plus size={16} /> Añadir paso
          </button>
        </div>
      </div>
    </div>
  )
}
