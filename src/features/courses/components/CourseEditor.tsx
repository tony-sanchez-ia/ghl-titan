'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Video, FileText, ListChecks, Eye, EyeOff,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import {
  addModule, updateModule, deleteModule, reorderModules,
  addLesson, updateLesson, deleteLesson, reorderLessons,
} from '@/actions/courses'
import { LessonEditorVideo } from './LessonEditorVideo'
import { LessonEditorText } from './LessonEditorText'
import { LessonEditorQuiz } from './LessonEditorQuiz'
import type { CourseWithContent, ModuleWithLessons } from '../services/courses'
import type { CourseLesson, LessonType } from '@/types/database'

const TYPE_ICON = { video: Video, text: FileText, quiz: ListChecks }

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const copy = [...arr]
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}

export function CourseEditor({ course }: { course: CourseWithContent }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    course.modules[0]?.lessons[0]?.id ?? null
  )
  const [busy, setBusy] = useState(false)

  const allLessons = course.modules.flatMap((m) => m.lessons)
  const selected = allLessons.find((l) => l.id === selectedId) ?? null

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    await fn()
    setBusy(false)
    router.refresh()
  }

  async function onAddModule() {
    await run(() => addModule(course.id, 'Nuevo módulo'))
  }
  async function onAddLesson(moduleId: string, type: LessonType) {
    setBusy(true)
    const res = await addLesson(moduleId, course.id, type, 'Nueva lección')
    setBusy(false)
    if (res && 'id' in res && res.id) setSelectedId(res.id)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
      {/* Árbol */}
      <div className={`${ui.card} p-4 space-y-4 self-start`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Contenido</h2>
          <button onClick={onAddModule} disabled={busy} className={`${ui.button} px-2 py-1 text-xs`}>
            <Plus size={13} /> Módulo
          </button>
        </div>

        {course.modules.length === 0 && (
          <p className="text-sm text-muted">Añade tu primer módulo.</p>
        )}

        <div className="space-y-3">
          {course.modules.map((m, mi) => (
            <ModuleBlock
              key={m.id}
              module={m}
              index={mi}
              total={course.modules.length}
              courseId={course.id}
              selectedId={selectedId}
              busy={busy}
              onSelect={setSelectedId}
              onAddLesson={onAddLesson}
              onMoveModule={(dir) =>
                run(() => reorderModules(course.id, move(course.modules, mi, dir).map((x) => x.id)))
              }
              onRenameModule={(title) => run(() => updateModule(m.id, course.id, title))}
              onDeleteModule={() => run(() => deleteModule(m.id, course.id))}
              onTogglePublish={(l) => run(() => updateLesson(l.id, course.id, { is_published: !l.is_published }))}
              onMoveLesson={(li, dir) =>
                run(() => reorderLessons(m.id, course.id, move(m.lessons, li, dir).map((x) => x.id)))
              }
            />
          ))}
        </div>
      </div>

      {/* Editor de lección */}
      <div className={`${ui.card} p-5`}>
        {selected ? (
          <LessonPanel key={selected.id} lesson={selected} courseId={course.id} busy={busy} onChanged={() => router.refresh()} onDeleted={() => { setSelectedId(null); router.refresh() }} />
        ) : (
          <div className="text-center py-16 text-muted">
            <FileText size={36} className="mx-auto opacity-50" />
            <p className="mt-3">Selecciona o crea una lección para editarla.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ModuleBlock({
  module: m, index, total, courseId, selectedId, busy,
  onSelect, onAddLesson, onMoveModule, onRenameModule, onDeleteModule, onTogglePublish, onMoveLesson,
}: {
  module: ModuleWithLessons
  index: number
  total: number
  courseId: string
  selectedId: string | null
  busy: boolean
  onSelect: (id: string) => void
  onAddLesson: (moduleId: string, type: LessonType) => void
  onMoveModule: (dir: -1 | 1) => void
  onRenameModule: (title: string) => void
  onDeleteModule: () => void
  onTogglePublish: (l: CourseLesson) => void
  onMoveLesson: (li: number, dir: -1 | 1) => void
}) {
  const [title, setTitle] = useState(m.title)

  return (
    <div className="border border-border rounded-lg p-2">
      <div className="flex items-center gap-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== m.title && onRenameModule(title)}
          className="flex-1 bg-transparent text-sm font-medium px-1 py-1 outline-none focus:bg-bg rounded"
        />
        <button onClick={() => onMoveModule(-1)} disabled={busy || index === 0} className="text-muted hover:text-fg disabled:opacity-30 p-0.5"><ChevronUp size={14} /></button>
        <button onClick={() => onMoveModule(1)} disabled={busy || index === total - 1} className="text-muted hover:text-fg disabled:opacity-30 p-0.5"><ChevronDown size={14} /></button>
        <button onClick={onDeleteModule} disabled={busy} className="text-muted hover:text-red-600 p-0.5"><Trash2 size={13} /></button>
      </div>

      <div className="mt-1 space-y-0.5">
        {m.lessons.map((l, li) => {
          const Icon = TYPE_ICON[l.type]
          return (
            <div key={l.id} className={`flex items-center gap-1 rounded px-1.5 py-1 text-sm ${selectedId === l.id ? 'bg-primary-soft text-primary' : 'hover:bg-bg'}`}>
              <Icon size={14} className="shrink-0 opacity-70" />
              <button onClick={() => onSelect(l.id)} className="flex-1 text-left truncate">{l.title}</button>
              <button onClick={() => onTogglePublish(l)} disabled={busy} className="text-muted hover:text-fg p-0.5" aria-label={l.is_published ? 'Despublicar' : 'Publicar'}>
                {l.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button onClick={() => onMoveLesson(li, -1)} disabled={busy || li === 0} className="text-muted hover:text-fg disabled:opacity-30 p-0.5"><ChevronUp size={12} /></button>
              <button onClick={() => onMoveLesson(li, 1)} disabled={busy || li === m.lessons.length - 1} className="text-muted hover:text-fg disabled:opacity-30 p-0.5"><ChevronDown size={12} /></button>
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-1 pl-1">
        <span className="text-xs text-muted">Añadir:</span>
        <button onClick={() => onAddLesson(m.id, 'video')} disabled={busy} className={`${ui.button} px-1.5 py-0.5 text-xs`}><Video size={12} /></button>
        <button onClick={() => onAddLesson(m.id, 'text')} disabled={busy} className={`${ui.button} px-1.5 py-0.5 text-xs`}><FileText size={12} /></button>
        <button onClick={() => onAddLesson(m.id, 'quiz')} disabled={busy} className={`${ui.button} px-1.5 py-0.5 text-xs`}><ListChecks size={12} /></button>
      </div>
    </div>
  )
}

function LessonPanel({
  lesson, courseId, busy, onChanged, onDeleted,
}: {
  lesson: CourseLesson
  courseId: string
  busy: boolean
  onChanged: () => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(lesson.title)
  const TYPE_LABEL = { video: 'Vídeo', text: 'Texto', quiz: 'Cuestionario' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== lesson.title && updateLesson(lesson.id, courseId, { title }).then(onChanged)}
          className="flex-1 text-lg font-semibold bg-transparent outline-none focus:bg-bg rounded px-1"
        />
        <span className="text-xs text-muted px-2 py-1 rounded bg-bg shrink-0">{TYPE_LABEL[lesson.type]}</span>
        <button
          onClick={() => { if (confirm('¿Borrar esta lección?')) deleteLesson(lesson.id, courseId).then(onDeleted) }}
          disabled={busy}
          className={`${ui.button} px-2 py-1.5 text-sm text-red-600`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={lesson.is_published}
          onChange={(e) => updateLesson(lesson.id, courseId, { is_published: e.target.checked }).then(onChanged)}
        />
        Publicada (visible para los alumnos)
      </label>

      {lesson.type === 'video' && <LessonEditorVideo lesson={lesson} courseId={courseId} />}
      {lesson.type === 'text' && <LessonEditorText lesson={lesson} courseId={courseId} />}
      {lesson.type === 'quiz' && <LessonEditorQuiz lesson={lesson} courseId={courseId} />}
    </div>
  )
}
