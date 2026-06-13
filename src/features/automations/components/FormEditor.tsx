'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, ExternalLink, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createForm, updateForm, deleteForm } from '@/actions/automations'
import type { Form } from '@/types/database'

export function FormEditor({ form }: { form?: Form }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const isEdit = !!form

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setMsg(null)
    const res = isEdit ? await updateForm(form!.id, formData) : await createForm(formData)
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    if (isEdit) { setMsg('Guardado'); router.refresh() }
    else if ('id' in res && res.id) router.push(`/automations/forms/${res.id}`)
  }

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/form/${form!.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function onDelete() {
    if (!confirm('¿Borrar este formulario?')) return
    setLoading(true)
    const res = await deleteForm(form!.id)
    if (res?.error) { setLoading(false); alert(res.error); return }
    router.push('/automations')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {isEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={copy} className={`${ui.button} px-3 py-2 text-sm`}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <Link href={`/form/${form!.slug}`} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
            <ExternalLink size={16} /> Ver
          </Link>
          <button onClick={onDelete} disabled={loading} className={`${ui.button} px-3 py-2 text-sm text-red-600`}>
            <Trash2 size={16} /> Borrar
          </button>
        </div>
      )}

      <form action={handleSubmit} className={`${ui.card} p-5 space-y-4`}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre del formulario</label>
          <input id="name" name="name" defaultValue={form?.name ?? ''} required className={ui.input} placeholder="Captura de leads" />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-1">
            Enlace público <span className="text-muted font-normal">(se genera del nombre si lo dejas vacío)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">/form/</span>
            <input id="slug" name="slug" defaultValue={form?.slug ?? ''} className={ui.input} placeholder="captura-leads" />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Descripción</label>
          <textarea id="description" name="description" defaultValue={form?.description ?? ''} rows={3} className={ui.input} placeholder="Déjanos tus datos y te contactamos." />
        </div>
        <p className="text-xs text-muted">
          Campos que recoge: nombre, email, teléfono y mensaje. Para enviar la secuencia, vincula este
          formulario desde una secuencia (sección Secuencias).
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <div className="flex gap-3">
          {!isEdit && <button type="button" onClick={() => router.back()} className={`${ui.button} px-4 py-2.5`}>Cancelar</button>}
          <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear formulario'}
          </button>
        </div>
      </form>
    </div>
  )
}
