'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import type { LessonType, Quiz } from '@/types/database'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function cookieName(courseId: string) {
  return `course_email_${courseId}`
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

// ─── Curso ────────────────────────────────────────────────────────────────
const courseSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(160),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  cover_image_url: z.string().trim().max(800).optional().nullable(),
})

export async function createCourse(formData: FormData) {
  const parsed = courseSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    cover_image_url: formData.get('cover_image_url'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const d = parsed.data
  try {
    const data = await queryOne<{ id: string }>(
      `insert into courses (title, slug, description, cover_image_url)
       values ($1, $2, $3, $4) returning id`,
      [
        d.title,
        d.slug ? slugify(d.slug) : slugify(d.title),
        d.description || null,
        d.cover_image_url || null,
      ]
    )
    revalidatePath('/courses')
    return { success: true, id: data!.id }
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un curso con ese enlace (slug)' }
    return { error: (err as Error).message }
  }
}

export async function updateCourse(id: string, formData: FormData) {
  const parsed = courseSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    cover_image_url: formData.get('cover_image_url'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const d = parsed.data
  try {
    await query(
      `update courses set title = $1, description = $2, cover_image_url = $3,
         slug = coalesce($4, slug), updated_at = now()
       where id = $5`,
      [d.title, d.description || null, d.cover_image_url || null, d.slug ? slugify(d.slug) : null, id]
    )
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un curso con ese enlace (slug)' }
    return { error: (err as Error).message }
  }
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  return { success: true }
}

export async function setCourseStatus(id: string, status: 'draft' | 'published'): Promise<{ success?: boolean; error?: string }> {
  await query('update courses set status = $1, updated_at = now() where id = $2', [status, id])
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  return { success: true }
}

export async function deleteCourse(id: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from courses where id = $1', [id])
  revalidatePath('/courses')
  return { success: true }
}

// ─── Módulos ────────────────────────────────────────────────────────────────
export async function addModule(courseId: string, title: string) {
  const data = await queryOne<{ id: string }>(
    `insert into course_modules (course_id, title, position)
     values ($1, $2, (select count(*) from course_modules where course_id = $1))
     returning id`,
    [courseId, title || 'Nuevo módulo']
  )
  revalidatePath(`/courses/${courseId}`)
  return { success: true, id: data!.id }
}

export async function updateModule(id: string, courseId: string, title: string): Promise<{ success?: boolean; error?: string }> {
  await query('update course_modules set title = $1 where id = $2', [title, id])
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function deleteModule(id: string, courseId: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from course_modules where id = $1', [id])
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      query('update course_modules set position = $1 where id = $2', [i, id])
    )
  )
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

// ─── Lecciones ────────────────────────────────────────────────────────────────
export async function addLesson(
  moduleId: string,
  courseId: string,
  type: LessonType,
  title: string
) {
  const data = await queryOne<{ id: string }>(
    `insert into course_lessons (module_id, title, type, position, quiz)
     values ($1, $2, $3, (select count(*) from course_lessons where module_id = $1), $4)
     returning id`,
    [
      moduleId,
      title || 'Nueva lección',
      type,
      type === 'quiz' ? { questions: [], passing: false } : null,
    ]
  )
  revalidatePath(`/courses/${courseId}`)
  return { success: true, id: data!.id }
}

export async function updateLesson(
  id: string,
  courseId: string,
  patch: {
    title?: string
    video_url?: string | null
    content?: string | null
    quiz?: Quiz | null
    is_published?: boolean
  }
): Promise<{ success?: boolean; error?: string }> {
  const sets: string[] = []
  const params: unknown[] = []
  const push = (col: string, value: unknown) => {
    params.push(value)
    sets.push(`${col} = $${params.length}`)
  }
  if (patch.title !== undefined) push('title', patch.title)
  if (patch.video_url !== undefined) push('video_url', patch.video_url)
  if (patch.content !== undefined) push('content', patch.content)
  if (patch.quiz !== undefined) push('quiz', patch.quiz === null ? null : JSON.stringify(patch.quiz))
  if (patch.is_published !== undefined) push('is_published', patch.is_published)
  if (sets.length === 0) return { success: true }

  params.push(id)
  await query(`update course_lessons set ${sets.join(', ')} where id = $${params.length}`, params)
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function deleteLesson(id: string, courseId: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from course_lessons where id = $1', [id])
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function reorderLessons(
  moduleId: string,
  courseId: string,
  orderedIds: string[]
) {
  await Promise.all(
    orderedIds.map((id, i) =>
      query('update course_lessons set position = $1 where id = $2', [i, id])
    )
  )
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

// ─── Alumno (público, acceso server-side) ────────────────────────────────────
const enrollSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  email: z.string().trim().email('Email inválido'),
})

export async function enrollStudent(formData: FormData) {
  const parsed = enrollSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { slug, name, email } = parsed.data

  const course = await queryOne<{ id: string }>(
    `select id from courses where slug = $1 and status = 'published'`,
    [slug]
  )
  if (!course) return { error: 'Curso no encontrado' }

  // Vincula/crea contacto por email (igual que las reservas)
  let contactId: string | null = null
  const foundContact = await queryOne<{ id: string }>(
    'select id from contacts where email ilike $1 limit 1',
    [email]
  )
  if (foundContact) {
    contactId = foundContact.id
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const nc = await queryOne<{ id: string }>(
      `insert into contacts (first_name, last_name, email, source, last_activity_at)
       values ($1, $2, $3, 'course', now()) returning id`,
      [firstName, rest.join(' ') || null, email]
    )
    contactId = nc?.id ?? null
  }

  // Crea/recupera enrollment (unique course_id+email)
  const existing = await queryOne<{ id: string }>(
    'select id from course_enrollments where course_id = $1 and email ilike $2',
    [course.id, email]
  )

  if (!existing) {
    await query(
      `insert into course_enrollments (course_id, contact_id, name, email)
       values ($1, $2, $3, $4)`,
      [course.id, contactId, name, email]
    )
    if (contactId) {
      await query(
        `insert into contact_activities (contact_id, type, description, metadata)
         values ($1, 'note', 'Inscrito en un curso', $2)`,
        [contactId, { course_id: course.id }]
      )
    }
  }

  const jar = await cookies()
  jar.set(cookieName(course.id), email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath(`/learn/${slug}`)
  return { success: true }
}

export async function markLessonComplete(slug: string, lessonId: string) {
  const course = await queryOne<{ id: string }>('select id from courses where slug = $1', [slug])
  if (!course) return { error: 'Curso no encontrado' }

  const jar = await cookies()
  const email = jar.get(cookieName(course.id))?.value
  if (!email) return { error: 'No identificado' }

  const enrollment = await queryOne<{ id: string }>(
    'select id from course_enrollments where course_id = $1 and email ilike $2',
    [course.id, email]
  )
  if (!enrollment) return { error: 'No inscrito' }

  await query(
    `insert into course_lesson_progress (enrollment_id, lesson_id)
     values ($1, $2) on conflict (enrollment_id, lesson_id) do nothing`,
    [enrollment.id, lessonId]
  )

  revalidatePath(`/learn/${slug}`)
  return { success: true }
}
