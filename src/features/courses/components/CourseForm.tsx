'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/shared/lib/ui'
import { createCourse, updateCourse } from '@/actions/courses'
import type { Course } from '@/types/database'

export function CourseForm({ course }: { course?: Course }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = !!course

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setMsg(null)
    const res = isEdit ? await updateCourse(course!.id, formData) : await createCourse(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    if (isEdit) {
      setMsg('Guardado')
      router.refresh()
    } else if ('id' in res && res.id) {
      router.push(`/courses/${res.id}`)
    }
  }

  return (
    <form action={handleSubmit} className={`${ui.card} p-5 space-y-4 max-w-2xl`}>
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Título</label>
        <input id="title" name="title" defaultValue={course?.title ?? ''} required className={ui.input} />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">
          Enlace público <span className="text-muted font-normal">(se genera del título si lo dejas vacío)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">/learn/</span>
          <input id="slug" name="slug" defaultValue={course?.slug ?? ''} className={ui.input} placeholder="ia-titans-express" />
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">Descripción</label>
        <textarea id="description" name="description" defaultValue={course?.description ?? ''} rows={3} className={ui.input} />
      </div>
      <div>
        <label htmlFor="cover_image_url" className="block text-sm font-medium mb-1">URL de portada</label>
        <input id="cover_image_url" name="cover_image_url" defaultValue={course?.cover_image_url ?? ''} className={ui.input} placeholder="https://..." />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <div className="flex gap-3">
        {!isEdit && (
          <button type="button" onClick={() => router.back()} className={`${ui.button} px-4 py-2.5`}>Cancelar</button>
        )}
        <button type="submit" disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
          {loading ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear curso'}
        </button>
      </div>
    </form>
  )
}
