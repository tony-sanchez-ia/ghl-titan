import { query, queryOne } from '@/lib/db'
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
  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    params.push(`%${search}%`)
    const p = `$${params.length}`
    conditions.push(
      `(first_name ilike ${p} or last_name ilike ${p} or email ilike ${p} or phone ilike ${p} or business_name ilike ${p})`
    )
  }

  if (tag) {
    params.push([tag])
    conditions.push(`tags @> $${params.length}`)
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  return query<Contact>(
    `select * from contacts ${where} order by created_at desc`,
    params
  )
}

/** Devuelve todos los tags distintos presentes en los contactos. */
export async function listAllTags(): Promise<string[]> {
  const rows = await query<{ tag: string }>(
    'select distinct unnest(tags) as tag from contacts order by tag'
  )
  return rows.map((r) => r.tag)
}

export interface ContactWithActivities extends Contact {
  activities: ContactActivity[]
}

/** Devuelve un contacto con su timeline de actividad. */
export async function getContactById(
  id: string
): Promise<ContactWithActivities | null> {
  const contact = await queryOne<Contact>('select * from contacts where id = $1', [id])
  if (!contact) return null

  const activities = await query<ContactActivity>(
    'select * from contact_activities where contact_id = $1 order by created_at desc',
    [id]
  )

  return { ...contact, activities }
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
  const [bookings, enrollments, emails] = await Promise.all([
    query<{ id: string; starts_at: string; status: string; calendar_name: string | null }>(
      `select b.id, b.starts_at, b.status, c.name as calendar_name
       from bookings b left join calendars c on c.id = b.calendar_id
       where b.contact_id = $1 order by b.starts_at desc`,
      [contactId]
    ),
    query<{ id: string; course_title: string; course_slug: string; completed: string; total: string }>(
      `select e.id, co.title as course_title, co.slug as course_slug,
              (select count(*) from course_lesson_progress p where p.enrollment_id = e.id) as completed,
              (select count(*) from course_lessons l
                 join course_modules m on m.id = l.module_id
               where m.course_id = co.id and l.is_published) as total
       from course_enrollments e join courses co on co.id = e.course_id
       where e.contact_id = $1`,
      [contactId]
    ),
    query<ContactScheduledEmail>(
      'select id, subject, status, send_at from scheduled_emails where contact_id = $1 order by send_at asc',
      [contactId]
    ),
  ])

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      calendarName: b.calendar_name,
      starts_at: b.starts_at,
      status: b.status,
    })),
    enrollments: enrollments.map((e) => ({
      id: e.id,
      courseTitle: e.course_title,
      courseSlug: e.course_slug,
      completed: Number(e.completed),
      total: Number(e.total),
    })),
    scheduledEmails: emails,
  }
}
