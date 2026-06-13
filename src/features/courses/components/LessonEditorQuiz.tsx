'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { updateLesson } from '@/actions/courses'
import type { CourseLesson, Quiz, QuizQuestion } from '@/types/database'

function uid(): string {
  return crypto.randomUUID()
}

export function LessonEditorQuiz({ lesson, courseId }: { lesson: CourseLesson; courseId: string }) {
  const [quiz, setQuiz] = useState<Quiz>(
    lesson.quiz ?? { questions: [], passing: false }
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function addQuestion() {
    const oid = uid()
    setQuiz((q) => ({
      ...q,
      questions: [
        ...q.questions,
        { id: uid(), text: '', options: [{ id: oid, text: '' }], correct_option_id: oid },
      ],
    }))
  }
  function updateQuestion(qid: string, patch: Partial<QuizQuestion>) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => (qq.id === qid ? { ...qq, ...patch } : qq)),
    }))
  }
  function removeQuestion(qid: string) {
    setQuiz((q) => ({ ...q, questions: q.questions.filter((qq) => qq.id !== qid) }))
  }
  function addOption(qid: string) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid ? { ...qq, options: [...qq.options, { id: uid(), text: '' }] } : qq
      ),
    }))
  }
  function updateOption(qid: string, oid: string, text: string) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid
          ? { ...qq, options: qq.options.map((o) => (o.id === oid ? { ...o, text } : o)) }
          : qq
      ),
    }))
  }
  function removeOption(qid: string, oid: string) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid ? { ...qq, options: qq.options.filter((o) => o.id !== oid) } : qq
      ),
    }))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await updateLesson(lesson.id, courseId, { quiz })
    setSaving(false)
    setMsg(res?.error ? res.error : 'Guardado')
  }

  return (
    <div className="space-y-4">
      {quiz.questions.map((q, qi) => (
        <div key={q.id} className={`${ui.card} p-4 space-y-3`}>
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-muted pt-2">{qi + 1}.</span>
            <input
              value={q.text}
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              placeholder="Enunciado de la pregunta"
              className={ui.input}
            />
            <button onClick={() => removeQuestion(q.id)} className="text-muted hover:text-red-600 p-2" aria-label="Quitar pregunta">
              <Trash2 size={16} />
            </button>
          </div>
          <div className="space-y-2 pl-6">
            {q.options.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correct_option_id === o.id}
                  onChange={() => updateQuestion(q.id, { correct_option_id: o.id })}
                  aria-label="Marcar como correcta"
                />
                <input
                  value={o.text}
                  onChange={(e) => updateOption(q.id, o.id, e.target.value)}
                  placeholder="Opción"
                  className={ui.input}
                />
                <button onClick={() => removeOption(q.id, o.id)} className="text-muted hover:text-red-600 p-1.5" aria-label="Quitar opción">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => addOption(q.id)} className={`${ui.button} px-2 py-1 text-xs`}>
              <Plus size={13} /> Añadir opción
            </button>
            <p className="text-xs text-muted">Marca el círculo de la opción correcta.</p>
          </div>
        </div>
      ))}

      <button onClick={addQuestion} className={`${ui.button} px-3 py-2 text-sm`}>
        <Plus size={15} /> Añadir pregunta
      </button>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={quiz.passing} onChange={(e) => setQuiz((q) => ({ ...q, passing: e.target.checked }))} />
        Requiere acertar para considerarse aprobado (informativo en esta versión)
      </label>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
          {saving ? 'Guardando...' : 'Guardar cuestionario'}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  )
}
