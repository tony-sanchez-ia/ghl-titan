import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Course,
  CourseModule,
  CourseLesson,
  CourseEnrollment,
} from '@/types/database'

export interface ModuleWithLessons extends CourseModule {
  lessons: CourseLesson[]
}
export interface CourseWithContent extends Course {
  modules: ModuleWithLessons[]
}
export interface CourseListItem extends Course {
  moduleCount: number
  enrollmentCount: number
}

/** [admin] Lista de cursos con conteos. */
export async function listCourses(): Promise<CourseListItem[]> {
  const supabase = await createClient()
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*, course_modules(count), course_enrollments(count)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (courses ?? []).map((c) => {
    const { course_modules, course_enrollments, ...course } = c as Course & {
      course_modules: { count: number }[]
      course_enrollments: { count: number }[]
    }
    return {
      ...course,
      moduleCount: course_modules?.[0]?.count ?? 0,
      enrollmentCount: course_enrollments?.[0]?.count ?? 0,
    }
  })
}

function assemble(
  course: Course,
  modules: CourseModule[],
  lessons: CourseLesson[]
): CourseWithContent {
  return {
    ...course,
    modules: modules.map((m) => ({
      ...m,
      lessons: lessons
        .filter((l) => l.module_id === m.id)
        .sort((a, b) => a.position - b.position),
    })),
  }
}

/** [admin] Curso completo para edición (todos los módulos y lecciones). */
export async function getCourseForEdit(
  id: string
): Promise<CourseWithContent | null> {
  const supabase = await createClient()
  const { data: course } = await supabase.from('courses').select('*').eq('id', id).single()
  if (!course) return null

  const { data: modules } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', id)
    .order('position')
  const moduleIds = (modules ?? []).map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await supabase.from('course_lessons').select('*').in('module_id', moduleIds).order('position')
    : { data: [] }

  return assemble(course as Course, (modules ?? []) as CourseModule[], (lessons ?? []) as CourseLesson[])
}

/** [público] Curso publicado por slug, solo con lecciones publicadas. */
export async function getPublicCourse(
  slug: string
): Promise<CourseWithContent | null> {
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!course) return null

  const { data: modules } = await admin
    .from('course_modules')
    .select('*')
    .eq('course_id', course.id)
    .order('position')
  const moduleIds = (modules ?? []).map((m) => m.id)
  const { data: lessons } = moduleIds.length
    ? await admin
        .from('course_lessons')
        .select('*')
        .in('module_id', moduleIds)
        .eq('is_published', true)
        .order('position')
    : { data: [] }

  const assembled = assemble(
    course as Course,
    (modules ?? []) as CourseModule[],
    (lessons ?? []) as CourseLesson[]
  )
  // Oculta módulos sin lecciones publicadas
  assembled.modules = assembled.modules.filter((m) => m.lessons.length > 0)
  return assembled
}

/** [público] Devuelve el enrollment por curso+email si existe, con sus lecciones completadas. */
export async function getEnrollment(
  courseId: string,
  email: string
): Promise<{ enrollment: CourseEnrollment; completedLessonIds: string[] } | null> {
  const admin = createAdminClient()
  const { data: enrollment } = await admin
    .from('course_enrollments')
    .select('*')
    .eq('course_id', courseId)
    .ilike('email', email)
    .maybeSingle()
  if (!enrollment) return null

  const { data: progress } = await admin
    .from('course_lesson_progress')
    .select('lesson_id')
    .eq('enrollment_id', enrollment.id)

  return {
    enrollment: enrollment as CourseEnrollment,
    completedLessonIds: (progress ?? []).map((p) => p.lesson_id),
  }
}

/** Lista plana de IDs de lecciones publicadas (para % de progreso). */
export function publishedLessonIds(course: CourseWithContent): string[] {
  return course.modules.flatMap((m) => m.lessons.map((l) => l.id))
}
