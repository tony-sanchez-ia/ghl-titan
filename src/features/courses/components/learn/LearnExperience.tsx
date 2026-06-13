'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, Video, FileText, ListChecks, Award } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { markLessonComplete } from '@/actions/courses'
import { toEmbedUrl } from '../../services/embed'
import { renderMarkdown } from '../../services/markdown'
import type { CourseWithContent } from '../../services/courses'
import type { CourseLesson } from '@/types/database'

const TYPE_ICON = { video: Video, text: FileText, quiz: ListChecks }

export function LearnExperience({
  course,
  completedLessonIds,
  studentName,
}: {
  course: CourseWithContent
  completedLessonIds: string[]
  studentName: string
}) {
  const router = useRouter()
  const lessons = course.modules.flatMap((m) => m.lessons)
  const [selectedId, setSelectedId] = useState(lessons[0]?.id ?? '')
  const completed = new Set(completedLessonIds)
  const selected = lessons.find((l) => l.id === selectedId) ?? lessons[0]

  const total = lessons.length
  const done = lessons.filter((l) => completed.has(l.id)).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  async function complete(id: string) {
    await markLessonComplete(course.slug, id)
    router.refresh()
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[18rem_1fr]">
      {/* Sidebar */}
      <aside className="bg-card border-r border-border p-4 lg:h-screen lg:sticky lg:top-0 overflow-y-auto">
        <h1 className="font-bold">{course.title}</h1>
        <p className="text-xs text-muted mt-1">Hola, {studentName}</p>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-bg overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted mt-1">{done}/{total} completadas ({pct}%)</p>
        </div>

        {allDone && (
          <Link href={`/learn/${course.slug}/certificate`} className={`${ui.buttonPrimary} w-full px-3 py-2 text-sm mt-3`}>
            <Award size={15} /> Ver certificado
          </Link>
        )}

        <nav className="mt-4 space-y-4">
          {course.modules.map((m) => (
            <div key={m.id}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{m.title}</p>
              <div className="space-y-0.5">
                {m.lessons.map((l) => {
                  const Icon = TYPE_ICON[l.type]
                  const isDone = completed.has(l.id)
                  return (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left ${selectedId === l.id ? 'bg-primary-soft text-primary' : 'hover:bg-bg'}`}
                    >
                      {isDone ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <Circle size={15} className="text-muted shrink-0" />}
                      <Icon size={13} className="shrink-0 opacity-60" />
                      <span className="truncate">{l.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Visor */}
      <main className="p-6 lg:p-10 max-w-3xl mx-auto w-full">
        {selected ? (
          <LessonView
            key={selected.id}
            lesson={selected}
            isCompleted={completed.has(selected.id)}
            onComplete={() => complete(selected.id)}
          />
        ) : (
          <p className="text-muted">Este curso aún no tiene lecciones.</p>
        )}
      </main>
    </div>
  )
}

function LessonView({
  lesson,
  isCompleted,
  onComplete,
}: {
  lesson: CourseLesson
  isCompleted: boolean
  onComplete: () => void
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">{lesson.title}</h2>

      {lesson.type === 'video' && lesson.video_url && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
          <iframe src={toEmbedUrl(lesson.video_url)} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}

      {lesson.type === 'text' && (
        <div className="space-y-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content ?? '') }} />
      )}

      {lesson.type === 'quiz' && <QuizPlayer lesson={lesson} />}

      <div className="pt-4 border-t border-border">
        {isCompleted ? (
          <span className="inline-flex items-center gap-2 text-emerald-600 font-medium">
            <CheckCircle2 size={18} /> Lección completada
          </span>
        ) : (
          <button onClick={onComplete} className={`${ui.buttonPrimary} px-4 py-2.5`}>
            Marcar como completada
          </button>
        )}
      </div>
    </div>
  )
}

function QuizPlayer({ lesson }: { lesson: CourseLesson }) {
  const quiz = lesson.quiz
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  if (!quiz || quiz.questions.length === 0) {
    return <p className="text-muted">Este cuestionario aún no tiene preguntas.</p>
  }

  const correct = quiz.questions.filter((q) => answers[q.id] === q.correct_option_id).length

  return (
    <div className="space-y-5">
      {quiz.questions.map((q, i) => (
        <div key={q.id} className={`${ui.card} p-4`}>
          <p className="font-medium">{i + 1}. {q.text}</p>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => {
              const selected = answers[q.id] === o.id
              const isCorrect = q.correct_option_id === o.id
              let cls = 'border-border'
              if (checked && selected && isCorrect) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
              else if (checked && selected && !isCorrect) cls = 'border-red-500 bg-red-50 dark:bg-red-900/20'
              else if (checked && isCorrect) cls = 'border-emerald-500'
              return (
                <label key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${cls}`}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={selected}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    disabled={checked}
                  />
                  <span className="text-sm">{o.text}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
      {checked ? (
        <p className="text-sm font-medium">Acertaste {correct} de {quiz.questions.length}.</p>
      ) : (
        <button onClick={() => setChecked(true)} className={`${ui.button} px-4 py-2`}>
          Comprobar respuestas
        </button>
      )}
    </div>
  )
}
