'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, ExternalLink, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { setCourseStatus, deleteCourse } from '@/actions/courses'
import type { Course } from '@/types/database'

export function CourseHeaderActions({ course }: { course: Course }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const published = course.status === 'published'

  async function togglePublish() {
    setBusy(true)
    await setCourseStatus(course.id, published ? 'draft' : 'published')
    setBusy(false)
    router.refresh()
  }
  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/learn/${course.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  async function onDelete() {
    if (!confirm('¿Borrar el curso y todo su contenido?')) return
    setBusy(true)
    const res = await deleteCourse(course.id)
    if (res?.error) { setBusy(false); alert(res.error); return }
    router.push('/courses')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs px-2 py-1 rounded-full ${published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
        {published ? 'Publicado' : 'Borrador'}
      </span>
      <button onClick={togglePublish} disabled={busy} className={`${ui.button} px-3 py-2 text-sm disabled:opacity-50`}>
        {published ? 'Despublicar' : 'Publicar'}
      </button>
      <button onClick={copy} className={`${ui.button} px-3 py-2 text-sm`}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar enlace'}
      </button>
      <Link href={`/learn/${course.slug}`} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
        <ExternalLink size={16} /> Ver
      </Link>
      <button onClick={onDelete} disabled={busy} className={`${ui.button} px-3 py-2 text-sm text-red-600`}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}
