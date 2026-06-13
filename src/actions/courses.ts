'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .insert({
      title: d.title,
      slug: d.slug ? slugify(d.slug) : slugify(d.title),
      description: d.description || null,
      cover_image_url: d.cover_image_url || null,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un curso con ese enlace (slug)' }
    return { error: error.message }
  }
  revalidatePath('/courses')
  return { success: true, id: data.id }
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
  const supabase = await createClient()
  const update: Record<string, unknown> = {
    title: d.title,
    description: d.description || null,
    cover_image_url: d.cover_image_url || null,
    updated_at: new Date().toISOString(),
  }
  if (d.slug) update.slug = slugify(d.slug)
  const { error } = await supabase.from('courses').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un curso con ese enlace (slug)' }
    return { error: error.message }
  }
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  return { success: true }
}

export async function setCourseStatus(id: string, status: 'draft' | 'published') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('courses')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  return { success: true }
}

export async function deleteCourse(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/courses')
  return { success: true }
}

// ─── Módulos ────────────────────────────────────────────────────────────────
export async function addModule(courseId: string, title: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('course_modules')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
  const { data, error } = await supabase
    .from('course_modules')
    .insert({ course_id: courseId, title: title || 'Nuevo módulo', position: count ?? 0 })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true, id: data.id }
}

export async function updateModule(id: string, courseId: string, title: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('course_modules').update({ title }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function deleteModule(id: string, courseId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('course_modules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  const supabase = await createClient()
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('course_modules').update({ position: i }).eq('id', id)
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
  const supabase = await createClient()
  const { count } = await supabase
    .from('course_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('module_id', moduleId)
  const { data, error } = await supabase
    .from('course_lessons')
    .insert({
      module_id: moduleId,
      title: title || 'Nueva lección',
      type,
      position: count ?? 0,
      quiz: type === 'quiz' ? { questions: [], passing: false } : null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true, id: data.id }
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
) {
  const supabase = await createClient()
  const { error } = await supabase.from('course_lessons').update(patch).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function deleteLesson(id: string, courseId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('course_lessons').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function reorderLessons(
  moduleId: string,
  courseId: string,
  orderedIds: string[]
) {
  const supabase = await createClient()
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('course_lessons').update({ position: i }).eq('id', id)
    )
  )
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

// ─── Alumno (público, service-role) ──────────────────────────────────────────
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

  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!course) return { error: 'Curso no encontrado' }

  // Vincula/crea contacto por email (igual que las reservas)
  let contactId: string | null = null
  const { data: foundContact } = await admin
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  if (foundContact) {
    contactId = foundContact.id
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const { data: nc } = await admin
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: rest.join(' ') || null,
        email,
        source: 'course',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    contactId = nc?.id ?? null
  }

  // Crea/recupera enrollment (unique course_id+email)
  const { data: existing } = await admin
    .from('course_enrollments')
    .select('id')
    .eq('course_id', course.id)
    .ilike('email', email)
    .maybeSingle()

  if (!existing) {
    await admin.from('course_enrollments').insert({
      course_id: course.id,
      contact_id: contactId,
      name,
      email,
    })
    if (contactId) {
      await admin.from('contact_activities').insert({
        contact_id: contactId,
        type: 'note',
        description: 'Inscrito en un curso',
        metadata: { course_id: course.id },
      })
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
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .single()
  if (!course) return { error: 'Curso no encontrado' }

  const jar = await cookies()
  const email = jar.get(cookieName(course.id))?.value
  if (!email) return { error: 'No identificado' }

  const { data: enrollment } = await admin
    .from('course_enrollments')
    .select('id')
    .eq('course_id', course.id)
    .ilike('email', email)
    .maybeSingle()
  if (!enrollment) return { error: 'No inscrito' }

  await admin
    .from('course_lesson_progress')
    .upsert(
      { enrollment_id: enrollment.id, lesson_id: lessonId },
      { onConflict: 'enrollment_id,lesson_id' }
    )

  revalidatePath(`/learn/${slug}`)
  return { success: true }
}
