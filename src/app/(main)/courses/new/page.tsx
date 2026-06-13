import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CourseForm } from '@/features/courses/components/CourseForm'

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Cursos
      </Link>
      <h1 className="text-2xl font-bold">Nuevo curso</h1>
      <CourseForm />
    </div>
  )
}
