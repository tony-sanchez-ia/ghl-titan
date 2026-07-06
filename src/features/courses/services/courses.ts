import { query, queryOne } from '@/lib/db'
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
  const rows = await query<Course & { module_count: string; enrollment_count: string }>(
    `select c.*,
       (select count(*) from course_modules m where m.course_id = c.id) as module_count,
       (select count(*) from course_enrollments e where e.course_id = c.id) as enrollment_count
     from courses c order by c.created_at desc`
  )
  return rows.map(({ module_count, enrollment_count, ...course }) => ({
    ...course,
    moduleCount: Number(module_count),
    enrollmentCount: Number(enrollment_count),
  }))
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
  const course = await queryOne<Course>('select * from courses where id = $1', [id])
  if (!course) return null

  const modules = await query<CourseModule>(
    'select * from course_modules where course_id = $1 order by position',
    [id]
  )
  const lessons = modules.length
    ? await query<CourseLesson>(
        'select * from course_lessons where module_id = any($1) order by position',
        [modules.map((m) => m.id)]
      )
    : []

  return assemble(course, modules, lessons)
}

/** [público] Curso publicado por slug, solo con lecciones publicadas. */
export async function getPublicCourse(
  slug: string
): Promise<CourseWithContent | null> {
  const course = await queryOne<Course>(
    `select * from courses where slug = $1 and status = 'published'`,
    [slug]
  )
  if (!course) return null

  const modules = await query<CourseModule>(
    'select * from course_modules where course_id = $1 order by position',
    [course.id]
  )
  const lessons = modules.length
    ? await query<CourseLesson>(
        'select * from course_lessons where module_id = any($1) and is_published order by position',
        [modules.map((m) => m.id)]
      )
    : []

  const assembled = assemble(course, modules, lessons)
  // Oculta módulos sin lecciones publicadas
  assembled.modules = assembled.modules.filter((m) => m.lessons.length > 0)
  return assembled
}

/** [público] Devuelve el enrollment por curso+email si existe, con sus lecciones completadas. */
export async function getEnrollment(
  courseId: string,
  email: string
): Promise<{ enrollment: CourseEnrollment; completedLessonIds: string[] } | null> {
  const enrollment = await queryOne<CourseEnrollment>(
    'select * from course_enrollments where course_id = $1 and email ilike $2',
    [courseId, email]
  )
  if (!enrollment) return null

  const progress = await query<{ lesson_id: string }>(
    'select lesson_id from course_lesson_progress where enrollment_id = $1',
    [enrollment.id]
  )

  return {
    enrollment,
    completedLessonIds: progress.map((p) => p.lesson_id),
  }
}

/** Lista plana de IDs de lecciones publicadas (para % de progreso). */
export function publishedLessonIds(course: CourseWithContent): string[] {
  return course.modules.flatMap((m) => m.lessons.map((l) => l.id))
}
