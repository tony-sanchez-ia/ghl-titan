'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Link2, Trash2, UserPlus } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { copyText } from '@/shared/lib/clipboard'
import { addStudent, removeStudent } from '@/actions/courses'
import type { StudentRow } from '@/features/courses/services/courses'

/**
 * Card de alumnos del curso: añadir por nombre+email, copiar el enlace de
 * acceso personal, ver progreso y quitar acceso.
 */
export function StudentsPanel({
  courseId,
  slug,
  totalLessons,
  students,
}: {
  courseId: string
  slug: string
  totalLessons: number
  students: StudentRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleAdd(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await addStudent(courseId, formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function handleCopy(student: StudentRow) {
    if (!student.access_token) return
    const url = `${window.location.origin}/learn/${slug}/access/${student.access_token}`
    if (await copyText(url)) {
      setCopiedId(student.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  async function handleRemove(student: StudentRow) {
    if (!confirm(`¿Quitar el acceso de ${student.name}? Se borrará también su progreso.`)) return
    await removeStudent(student.id, courseId)
    router.refresh()
  }

  return (
    <div className={`${ui.card} p-5 space-y-4`}>
      <div>
        <h2 className="font-semibold">Alumnos ({students.length})</h2>
        <p className="text-sm text-muted mt-0.5">
          Añade un alumno y pásale su enlace de acceso personal: entra directo, sin formulario.
        </p>
      </div>

      <form action={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input name="name" required placeholder="Nombre" className={`${ui.input} sm:max-w-52`} />
        <input
          name="email"
          type="email"
          required
          placeholder="email@ejemplo.com"
          className={`${ui.input} sm:max-w-64`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50 shrink-0`}
        >
          <UserPlus size={16} /> {loading ? 'Añadiendo…' : 'Añadir alumno'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {students.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-4 font-medium">Alumno</th>
                <th className="py-2 pr-4 font-medium">Progreso</th>
                <th className="py-2 pr-4 font-medium">Alta</th>
                <th className="py-2 font-medium sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted text-xs">{s.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {s.completedCount}/{totalLessons} lecciones
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-muted">
                    {new Date(s.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleCopy(s)}
                      className={`${ui.button} px-2.5 py-1.5 text-xs mr-2`}
                      title="Copiar enlace de acceso personal"
                    >
                      {copiedId === s.id ? <Check size={14} /> : <Link2 size={14} />}
                      {copiedId === s.id ? 'Copiado' : 'Enlace de acceso'}
                    </button>
                    <button
                      onClick={() => handleRemove(s)}
                      className={`${ui.button} px-2.5 py-1.5 text-xs text-red-600`}
                      title="Quitar acceso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
