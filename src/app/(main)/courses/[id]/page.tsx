import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCourseForEdit } from '@/features/courses/services/courses'
import { CourseEditor } from '@/features/courses/components/CourseEditor'
import { CourseForm } from '@/features/courses/components/CourseForm'
import { CourseHeaderActions } from '@/features/courses/components/CourseHeaderActions'

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseForEdit(id)
  if (!course) notFound()

  return (
    <div className="space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Cursos
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <CourseHeaderActions course={course} />
      </div>

      <CourseEditor course={course} />

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
