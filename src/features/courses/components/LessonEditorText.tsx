'use client'

import { useState } from 'react'
import { ui } from '@/shared/lib/ui'
import { updateLesson } from '@/actions/courses'
import { renderMarkdown } from '../services/markdown'
import type { CourseLesson } from '@/types/database'

export function LessonEditorText({ lesson, courseId }: { lesson: CourseLesson; courseId: string }) {
  const [content, setContent] = useState(lesson.content ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await updateLesson(lesson.id, courseId, { content: content || null })
    setSaving(false)
    setMsg(res?.error ? res.error : 'Guardado')
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Contenido (markdown)</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} className={`${ui.input} font-mono text-sm`} placeholder="**Negrita**, *cursiva*, - listas, [enlaces](https://...)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Vista previa</label>
          <div className={`${ui.card} p-4 prose-sm space-y-2 min-h-[14rem]`} dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
          {saving ? 'Guardando...' : 'Guardar texto'}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  )
}
