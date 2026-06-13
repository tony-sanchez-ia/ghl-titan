'use client'

import { useState } from 'react'
import { ui } from '@/shared/lib/ui'
import { updateLesson } from '@/actions/courses'
import { toEmbedUrl } from '../services/embed'
import type { CourseLesson } from '@/types/database'

export function LessonEditorVideo({ lesson, courseId }: { lesson: CourseLesson; courseId: string }) {
  const [url, setUrl] = useState(lesson.video_url ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const embed = toEmbedUrl(url)

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await updateLesson(lesson.id, courseId, { video_url: url || null })
    setSaving(false)
    setMsg(res?.error ? res.error : 'Guardado')
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">URL del vídeo (YouTube, Vimeo, Bunny)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className={ui.input} />
      </div>
      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
          <iframe src={embed} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
          {saving ? 'Guardando...' : 'Guardar vídeo'}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  )
}
