import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactActivity } from '../types'

export interface ListContactsParams {
  search?: string
  tag?: string
}

/** Lista contactos con búsqueda por texto y filtro por tag. */
export async function listContacts({
  search,
  tag,
}: ListContactsParams = {}): Promise<Contact[]> {
  const supabase = await createClient()
  let query = supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    const term = `%${search}%`
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term},business_name.ilike.${term}`
    )
  }

  if (tag) {
    query = query.contains('tags', [tag])
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Devuelve todos los tags distintos presentes en los contactos. */
export async function listAllTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('contacts').select('tags')
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const row of data ?? []) {
    for (const t of (row.tags as string[]) ?? []) set.add(t)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export interface ContactWithActivities extends Contact {
  activities: ContactActivity[]
}

/** Devuelve un contacto con su timeline de actividad. */
export async function getContactById(
  id: string
): Promise<ContactWithActivities | null> {
  const supabase = await createClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !contact) return null

  const { data: activities } = await supabase
    .from('contact_activities')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })

  return { ...contact, activities: activities ?? [] }
}

export interface ContactBooking {
  id: string
  calendarName: string | null
  starts_at: string
  status: string
}
export interface ContactEnrollment {
  id: string
  courseTitle: string
  courseSlug: string
  completed: number
  total: number
}
export interface ContactScheduledEmail {
  id: string
  subject: string
  status: string
  send_at: string
}
export interface ContactRelated {
  bookings: ContactBooking[]
  enrollments: ContactEnrollment[]
  scheduledEmails: ContactScheduledEmail[]
}

/** Reúne citas, inscripciones a cursos (con progreso) y emails programados de un contacto. */
export async function getContactRelated(contactId: string): Promise<ContactRelated> {
  const supabase = await createClient()

  const [{ data: bookings }, { data: enrollments }, { data: emails }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, starts_at, status, calendar:calendars(name)')
      .eq('contact_id', contactId)
      .order('starts_at', { ascending: false }),
    supabase
      .from('course_enrollments')
      .select('id, course:courses(id, title, slug)')
      .eq('contact_id', contactId),
    supabase
      .from('scheduled_emails')
      .select('id, subject, status, send_at')
      .eq('contact_id', contactId)
      .order('send_at', { ascending: true }),
  ])

  // Progreso por inscripción
  const enrollmentDetails: ContactEnrollment[] = []
  for (const e of enrollments ?? []) {
    const course = (e as unknown as { course: { id: string; title: string; slug: string } | null }).course
    if (!course) continue
    const [{ count: completed }, { count: total }] = await Promise.all([
      supabase
        .from('course_lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_id', e.id),
      supabase
        .from('course_lessons')
        .select('id, course_modules!inner(course_id)', { count: 'exact', head: true })
        .eq('is_published', true)
        .eq('course_modules.course_id', course.id),
    ])
    enrollmentDetails.push({
      id: e.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      completed: completed ?? 0,
      total: total ?? 0,
    })
  }

  return {
    bookings: (bookings ?? []).map((b) => {
      const cal = (b as unknown as { calendar: { name: string } | null }).calendar
      return { id: b.id, calendarName: cal?.name ?? null, starts_at: b.starts_at, status: b.status }
    }),
    enrollments: enrollmentDetails,
    scheduledEmails: (emails ?? []) as ContactScheduledEmail[],
  }
}
