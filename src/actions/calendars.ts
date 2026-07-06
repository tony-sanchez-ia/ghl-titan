'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { generateSlots } from '@/features/scheduling/services/availability'
import { sendBookingEmails } from '@/features/notifications/services/booking-emails'
import { fireTrigger } from '@/features/automations/services/engine'
import { processDueEmails } from '@/features/automations/services/email-engine'
import type { Calendar, CalendarAvailability } from '@/types/database'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // elimina acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

const calendarSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_min: z.coerce.number().int().min(5).max(480),
  min_notice_hours: z.coerce.number().int().min(0).max(720),
  window_days: z.coerce.number().int().min(1).max(120),
  buffer_before_min: z.coerce.number().int().min(0).max(240),
  buffer_after_min: z.coerce.number().int().min(0).max(240),
  location_type: z.enum(['google_meet', 'custom_link', 'in_person']),
  location_value: z.string().trim().max(500).optional().nullable(),
})

function parseForm(formData: FormData) {
  return calendarSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    duration_min: formData.get('duration_min'),
    min_notice_hours: formData.get('min_notice_hours'),
    window_days: formData.get('window_days'),
    buffer_before_min: formData.get('buffer_before_min'),
    buffer_after_min: formData.get('buffer_after_min'),
    location_type: formData.get('location_type'),
    location_value: formData.get('location_value'),
  })
}

export async function createCalendar(formData: FormData) {
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const d = parsed.data
  const slug = d.slug ? slugify(d.slug) : slugify(d.name)

  try {
    const data = await queryOne<{ id: string }>(
      `insert into calendars (name, slug, description, duration_min, min_notice_hours, window_days,
         buffer_before_min, buffer_after_min, location_type, location_value)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        d.name,
        slug,
        d.description || null,
        d.duration_min,
        d.min_notice_hours,
        d.window_days,
        d.buffer_before_min,
        d.buffer_after_min,
        d.location_type,
        d.location_value || null,
      ]
    )
    revalidatePath('/calendars')
    return { success: true, id: data!.id }
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un calendario con ese enlace (slug)' }
    return { error: (err as Error).message }
  }
}

export async function updateCalendar(id: string, formData: FormData) {
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const d = parsed.data

  try {
    await query(
      `update calendars set name = $1, description = $2, duration_min = $3, min_notice_hours = $4,
         window_days = $5, buffer_before_min = $6, buffer_after_min = $7, location_type = $8,
         location_value = $9, slug = coalesce($10, slug), updated_at = now()
       where id = $11`,
      [
        d.name,
        d.description || null,
        d.duration_min,
        d.min_notice_hours,
        d.window_days,
        d.buffer_before_min,
        d.buffer_after_min,
        d.location_type,
        d.location_value || null,
        d.slug ? slugify(d.slug) : null,
        id,
      ]
    )
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un calendario con ese enlace (slug)' }
    return { error: (err as Error).message }
  }

  revalidatePath('/calendars')
  revalidatePath(`/calendars/${id}`)
  return { success: true }
}

export async function deleteCalendar(id: string): Promise<{ success?: boolean; error?: string }> {
  await query('delete from calendars where id = $1', [id])
  revalidatePath('/calendars')
  return { success: true }
}

const availabilityRule = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
})

/** Reemplaza todas las franjas de disponibilidad del calendario. */
export async function setAvailability(
  calendarId: string,
  rules: { weekday: number; start_time: string; end_time: string }[]
) {
  const parsed = z.array(availabilityRule).safeParse(rules)
  if (!parsed.success) return { error: 'Franjas inválidas' }

  // Valida que end > start en cada franja
  for (const r of parsed.data) {
    if (r.end_time <= r.start_time) {
      return { error: `Franja inválida: ${r.start_time}–${r.end_time}` }
    }
  }

  await query('delete from calendar_availability where calendar_id = $1', [calendarId])

  for (const r of parsed.data) {
    await query(
      `insert into calendar_availability (calendar_id, weekday, start_time, end_time)
       values ($1, $2, $3, $4)`,
      [calendarId, r.weekday, `${r.start_time}:00`, `${r.end_time}:00`]
    )
  }

  revalidatePath(`/calendars/${calendarId}`)
  return { success: true }
}

const bookingSchema = z.object({
  slug: z.string().min(1),
  slotIso: z.string().min(1),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  email: z.string().trim().email('Email inválido'),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

/** [público] Crea una reserva (sin sesión; el acceso es server-side). */
export async function createPublicBooking(formData: FormData) {
  const parsed = bookingSchema.safeParse({
    slug: formData.get('slug'),
    slotIso: formData.get('slotIso'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { slug, slotIso, name, email, phone, notes } = parsed.data

  const calendar = await queryOne<Calendar>(
    'select * from calendars where slug = $1 and is_active',
    [slug]
  )
  if (!calendar) return { error: 'Calendario no encontrado' }

  const [availability, existing] = await Promise.all([
    query<CalendarAvailability>(
      'select * from calendar_availability where calendar_id = $1',
      [calendar.id]
    ),
    query<{ starts_at: string; ends_at: string }>(
      `select starts_at, ends_at from bookings
       where calendar_id = $1 and status = 'confirmed' and starts_at >= now()`,
      [calendar.id]
    ),
  ])

  // Revalida que el hueco siga siendo válido y libre.
  const days = generateSlots(calendar, availability, existing)
  const isValidSlot = days.some((d) => d.slots.some((s) => s.iso === slotIso))
  if (!isValidSlot) {
    return { error: 'Ese horario ya no está disponible. Elige otro, por favor.' }
  }

  const startsAt = new Date(slotIso)
  const endsAt = new Date(startsAt.getTime() + calendar.duration_min * 60_000)

  // Vincula o crea el contacto (dedup por email).
  let contactId: string | null = null
  const foundContact = await queryOne<{ id: string }>(
    'select id from contacts where email ilike $1 limit 1',
    [email]
  )

  if (foundContact) {
    contactId = foundContact.id
    await query('update contacts set last_activity_at = now() where id = $1', [contactId])
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const newContact = await queryOne<{ id: string }>(
      `insert into contacts (first_name, last_name, email, phone, source, last_activity_at)
       values ($1, $2, $3, $4, 'booking', now()) returning id`,
      [firstName, rest.join(' ') || null, email, phone || null]
    )
    contactId = newContact?.id ?? null
  }

  // Crea la cita.
  let bookingId: string
  try {
    const booking = await queryOne<{ id: string }>(
      `insert into bookings (calendar_id, contact_id, name, email, phone, starts_at, ends_at,
         status, location_type, location_value, notes)
       values ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8, $9, $10) returning id`,
      [
        calendar.id,
        contactId,
        name,
        email,
        phone || null,
        startsAt.toISOString(),
        endsAt.toISOString(),
        calendar.location_type,
        calendar.location_value,
        notes || null,
      ]
    )
    bookingId = booking!.id
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: 'Ese horario acaba de ser reservado. Elige otro, por favor.' }
    }
    return { error: (err as Error).message }
  }

  // Registra la actividad en el timeline del contacto.
  if (contactId) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'booking_created', $2, $3)`,
      [contactId, `Reserva: ${calendar.name}`, { booking_id: bookingId, starts_at: startsAt.toISOString() }]
    )
  }

  // Envía emails (no bloquea: si falla o no hay dominio verificado, la reserva ya está hecha).
  await sendBookingEmails({
    booking: {
      name,
      email,
      phone: phone || null,
      starts_at: startsAt.toISOString(),
      location_type: calendar.location_type,
      location_value: calendar.location_value,
      notes: notes || null,
    },
    calendar: { name: calendar.name },
  })

  if (contactId) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'email_sent', 'Email de confirmación enviado', '{}')`,
      [contactId]
    )

    // Dispara los workflows con trigger "reserva creada" (no bloquea la reserva)
    try {
      await fireTrigger('booking_created', { calendarId: calendar.id }, contactId, email)
      await processDueEmails()
    } catch {
      /* la reserva ya está hecha; no romper la respuesta */
    }
  }

  revalidatePath('/calendars')
  revalidatePath('/dashboard')

  return {
    success: true,
    locationType: calendar.location_type as string,
    locationValue: calendar.location_value as string | null,
  }
}

// ─── Gestión de citas (admin) ────────────────────────────────────────────────
export async function cancelBooking(id: string) {
  const booking = await queryOne<{ contact_id: string | null }>(
    `update bookings set status = 'cancelled' where id = $1 returning contact_id`,
    [id]
  )
  if (!booking) return { error: 'Cita no encontrada' }

  if (booking.contact_id) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'note', 'Cita cancelada', $2)`,
      [booking.contact_id, { booking_id: id }]
    )
  }
  revalidatePath('/calendars')
  revalidatePath('/calendars/bookings')
  revalidatePath('/dashboard')
  return { success: true }
}

/** [admin] Huecos disponibles para reprogramar una cita (excluye la propia). */
export async function getRescheduleSlots(bookingId: string) {
  const booking = await queryOne<{ id: string; calendar_id: string }>(
    'select id, calendar_id from bookings where id = $1',
    [bookingId]
  )
  if (!booking) return { error: 'Cita no encontrada' }

  const calendar = await queryOne<Calendar>('select * from calendars where id = $1', [
    booking.calendar_id,
  ])
  if (!calendar) return { error: 'Calendario no encontrado' }

  const [availability, others] = await Promise.all([
    query<CalendarAvailability>(
      'select * from calendar_availability where calendar_id = $1',
      [booking.calendar_id]
    ),
    query<{ starts_at: string; ends_at: string }>(
      `select starts_at, ends_at from bookings
       where calendar_id = $1 and status = 'confirmed' and id <> $2 and starts_at >= now()`,
      [booking.calendar_id, bookingId]
    ),
  ])

  const days = generateSlots(calendar, availability, others)
  return { success: true, days }
}

export async function rescheduleBooking(bookingId: string, slotIso: string) {
  const booking = await queryOne<{ id: string; calendar_id: string; contact_id: string | null }>(
    'select id, calendar_id, contact_id from bookings where id = $1',
    [bookingId]
  )
  if (!booking) return { error: 'Cita no encontrada' }

  const calendar = await queryOne<{ duration_min: number }>(
    'select duration_min from calendars where id = $1',
    [booking.calendar_id]
  )
  if (!calendar) return { error: 'Calendario no encontrado' }

  const startsAt = new Date(slotIso)
  const endsAt = new Date(startsAt.getTime() + calendar.duration_min * 60_000)

  try {
    await query('update bookings set starts_at = $1, ends_at = $2 where id = $3', [
      startsAt.toISOString(),
      endsAt.toISOString(),
      bookingId,
    ])
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ese horario ya está ocupado' }
    return { error: (err as Error).message }
  }

  if (booking.contact_id) {
    await query(
      `insert into contact_activities (contact_id, type, description, metadata)
       values ($1, 'note', 'Cita reprogramada', $2)`,
      [booking.contact_id, { booking_id: bookingId, starts_at: startsAt.toISOString() }]
    )
  }
  revalidatePath('/calendars')
  revalidatePath('/calendars/bookings')
  return { success: true }
}
