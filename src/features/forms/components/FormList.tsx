'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, FileText, Plus, Send } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createForm } from '@/actions/forms'
import type { FormListItem } from '../services/queries'

export function FormList({ forms }: { forms: FormListItem[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setLoading(true)
    setError(null)
    const res = await createForm(name || 'Formulario sin título')
    setLoading(false)
    if (res.error || !res.id) {
      setError(res.error ?? 'No se pudo crear')
      return
    }
    router.push(`/forms/${res.id}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formularios</h1>
          <p className="text-muted text-sm mt-0.5">Capta leads desde tu web, funnels o un enlace directo.</p>
        </div>
        <button onClick={() => setCreating(true)} className={`${ui.buttonPrimary} px-4 py-2.5`}>
          <Plus size={18} /> Nuevo formulario
        </button>
      </div>

      {forms.length === 0 ? (
        <div className={`${ui.card} p-12 text-center`}>
          <FileText size={40} className="mx-auto text-muted" />
          <h2 className="text-lg font-semibold mt-3">Aún no tienes formularios</h2>
          <p className="text-muted text-sm mt-1">Crea tu primer formulario para empezar a captar contactos.</p>
          <button onClick={() => setCreating(true)} className={`${ui.buttonPrimary} px-4 py-2.5 mt-4`}>
            <Plus size={18} /> Nuevo formulario
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((f) => (
            <Link key={f.id} href={`/forms/${f.id}`} className={`${ui.card} p-4 hover:border-primary transition-colors block`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">{f.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${f.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {f.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
              </div>
              <p className="text-xs text-muted font-mono mt-1 truncate">/form/{f.slug}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted">
                <span className="inline-flex items-center gap-1"><Eye size={14} /> {f.views}</span>
                <span className="inline-flex items-center gap-1"><Send size={14} /> {f.submissions}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div className={`${ui.card} p-5 w-full max-w-md space-y-4`} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Nuevo formulario</h2>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Nombre</span>
              <input
                autoFocus
                className={ui.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Captación web"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className={`${ui.button} px-4 py-2`}>Cancelar</button>
              <button onClick={create} disabled={loading} className={`${ui.buttonPrimary} px-4 py-2 disabled:opacity-50`}>
                {loading ? 'Creando…' : 'Crear y editar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
