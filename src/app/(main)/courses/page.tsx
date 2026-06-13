import Link from 'next/link'
import { Plus, GraduationCap, Users, Layers } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { listCourses } from '@/features/courses/services/courses'

export default async function CoursesPage() {
  const courses = await listCourses()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cursos</h1>
          <p className="mt-1 text-muted">Tu academia online.</p>
        </div>
        <Link href="/courses/new" className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
          <Plus size={16} /> Nuevo curso
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className={`${ui.card} p-12 text-center`}>
          <GraduationCap size={40} className="mx-auto text-muted" />
          <p className="mt-3 text-muted">Aún no tienes cursos.</p>
          <Link href="/courses/new" className={`${ui.buttonPrimary} px-4 py-2.5 text-sm mt-4`}>
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className={`${ui.card} overflow-hidden hover:border-primary transition-colors`}>
              <div className="aspect-video bg-bg flex items-center justify-center overflow-hidden">
                {c.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt={c.title} className="h-full w-full object-cover" />
                ) : (
                  <GraduationCap size={32} className="text-muted" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">{c.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
                    {c.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5"><Layers size={14} /> {c.moduleCount}</span>
                  <span className="inline-flex items-center gap-1.5"><Users size={14} /> {c.enrollmentCount}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
