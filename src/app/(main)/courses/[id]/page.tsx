import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { getCourseForEdit, listStudents } from '@/features/courses/services/courses'
import { CourseEditor } from '@/features/courses/components/CourseEditor'
import { CourseForm } from '@/features/courses/components/CourseForm'
import { CourseHeaderActions } from '@/features/courses/components/CourseHeaderActions'
import { StudentsPanel } from '@/features/courses/components/StudentsPanel'

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseForEdit(id)
  if (!course) notFound()

  const students = await listStudents(id)
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0)

  return (
    <div className="space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Cursos
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <CourseHeaderActions course={course} />
      </div>

      {course.status !== 'published' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Este curso está en borrador:</strong> los alumnos NO pueden verlo todavía
            (el enlace público da &quot;no encontrado&quot;). Cuando esté listo, pulsa{' '}
            <strong>Publicar curso</strong> arriba a la derecha.
          </p>
        </div>
      )}

      <CourseEditor course={course} />

      <StudentsPanel
        courseId={course.id}
        slug={course.slug}
        totalLessons={totalLessons}
        students={students}
      />

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-fg">
          Configuración del curso
        </summary>
        <div className="mt-4">
          <CourseForm course={course} />
        </div>
      </details>
    </div>
  )
}
