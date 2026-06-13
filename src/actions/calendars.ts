'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSlots } from '@/features/scheduling/services/availability'
import { sendBookingEmails } from '@/features/notifications/services/booking-emails'
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
  const supabase = await createClient()
  const slug = d.slug ? slugify(d.slug) : slugify(d.name)

  const { data, error } = await supabase
    .from('calendars')
    .insert({
      name: d.name,
      slug,
      description: d.description || null,
      duration_min: d.duration_min,
      min_notice_hours: d.min_notice_hours,
      window_days: d.window_days,
      buffer_before_min: d.buffer_before_min,
      buffer_after_min: d.buffer_after_min,
      location_type: d.location_type,
      location_value: d.location_value || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un calendario con ese enlace (slug)' }
    return { error: error.message }
  }

  revalidatePath('/calendars')
  return { success: true, id: data.id }
}

export async function updateCalendar(id: string, formData: FormData) {
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const d = parsed.data
  const supabase = await createClient()
  const update: Partial<Calendar> = {
    name: d.name,
    description: d.description || null,
    duration_min: d.duration_min,
    min_notice_hours: d.min_notice_hours,
    window_days: d.window_days,
    buffer_before_min: d.buffer_before_min,
    buffer_after_min: d.buffer_after_min,
    location_type: d.location_type,
    location_value: d.location_value || null,
    updated_at: new Date().toISOString(),
  }
  if (d.slug) update.slug = slugify(d.slug)

  const { error } = await supabase.from('calendars').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un calendario con ese enlace (slug)' }
    return { error: error.message }
  }

  revalidatePath('/calendars')
  revalidatePath(`/calendars/${id}`)
  return { success: true }
}

export async function deleteCalendar(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('calendars').delete().eq('id', id)
  if (error) return { error: error.message }
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

  const supabase = await createClient()
  await supabase.from('calendar_availability').delete().eq('calendar_id', calendarId)

  if (parsed.data.length > 0) {
    const { error } = await supabase.from('calendar_availability').insert(
      parsed.data.map((r) => ({
        calendar_id: calendarId,
        weekday: r.weekday,
        start_time: `${r.start_time}:00`,
        end_time: `${r.end_time}:00`,
      }))
    )
    if (error) return { error: error.message }
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

/** [público] Crea una reserva. Usa service-role (no hay sesión). */
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

  const admin = createAdminClient()

  const { data: calendar } = await admin
    .from('calendars')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (!calendar) return { error: 'Calendario no encontrado' }

  const [{ data: availability }, { data: existing }] = await Promise.all([
    admin.from('calendar_availability').select('*').eq('calendar_id', calendar.id),
    admin
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('calendar_id', calendar.id)
      .eq('status', 'confirmed')
      .gte('starts_at', new Date().toISOString()),
  ])

  // Revalida que el hueco siga siendo válido y libre.
  const days = generateSlots(
    calendar as Calendar,
    (availability ?? []) as CalendarAvailability[],
    existing ?? []
  )
  const isValidSlot = days.some((d) => d.slots.some((s) => s.iso === slotIso))
  if (!isValidSlot) {
    return { error: 'Ese horario ya no está disponible. Elige otro, por favor.' }
  }

  const startsAt = new Date(slotIso)
  const endsAt = new Date(startsAt.getTime() + calendar.duration_min * 60_000)

  // Vincula o crea el contacto (dedup por email).
  let contactId: string | null = null
  const { data: foundContact } = await admin
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (foundContact) {
    contactId = foundContact.id
    await admin
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', contactId)
  } else {
    const [firstName, ...rest] = name.trim().split(' ')
    const { data: newContact } = await admin
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: rest.join(' ') || null,
        email,
        phone: phone || null,
        source: 'booking',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    contactId = newContact?.id ?? null
  }

  // Crea la cita.
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      calendar_id: calendar.id,
      contact_id: contactId,
      name,
      email,
      phone: phone || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'confirmed',
      location_type: calendar.location_type,
      location_value: calendar.location_value,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (bookingError) {
    if (bookingError.code === '23505') {
      return { error: 'Ese horario acaba de ser reservado. Elige otro, por favor.' }
    }
    return { error: bookingError.message }
  }

  // Registra la actividad en el timeline del contacto.
  if (contactId) {
    await admin.from('contact_activities').insert({
      contact_id: contactId,
      type: 'booking_created',
      description: `Reserva: ${calendar.name}`,
      metadata: { booking_id: booking.id, starts_at: startsAt.toISOString() },
    })
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
    await admin.from('contact_activities').insert({
      contact_id: contactId,
      type: 'email_sent',
      description: 'Email de confirmación enviado',
      metadata: {},
    })
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
  const supabase = await createClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('contact_id, name, starts_at')
    .single()
  if (error) return { error: error.message }

  if (booking?.contact_id) {
    await supabase.from('contact_activities').insert({
      contact_id: booking.contact_id,
      type: 'note',
      description: 'Cita cancelada',
      metadata: { booking_id: id },
    })
  }
  revalidatePath('/calendars')
  revalidatePath('/calendars/bookings')
  revalidatePath('/dashboard')
  return { success: true }
}

/** [admin] Huecos disponibles para reprogramar una cita (excluye la propia). */
export async function getRescheduleSlots(bookingId: string) {
  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, calendar_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Cita no encontrada' }

  const { data: calendar } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', booking.calendar_id)
    .single()
  if (!calendar) return { error: 'Calendario no encontrado' }

  const [{ data: availability }, { data: others }] = await Promise.all([
    supabase.from('calendar_availability').select('*').eq('calendar_id', booking.calendar_id),
    supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('calendar_id', booking.calendar_id)
      .eq('status', 'confirmed')
      .neq('id', bookingId)
      .gte('starts_at', new Date().toISOString()),
  ])

  const days = generateSlots(
    calendar as Calendar,
    (availability ?? []) as CalendarAvailability[],
    others ?? []
  )
  return { success: true, days }
}

export async function rescheduleBooking(bookingId: string, slotIso: string) {
  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, calendar_id, contact_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { error: 'Cita no encontrada' }

  const { data: calendar } = await supabase
    .from('calendars')
    .select('duration_min')
    .eq('id', booking.calendar_id)
    .single()
  if (!calendar) return { error: 'Calendario no encontrado' }

  const startsAt = new Date(slotIso)
  const endsAt = new Date(startsAt.getTime() + calendar.duration_min * 60_000)

  const { error } = await supabase
    .from('bookings')
    .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    .eq('id', bookingId)
  if (error) {
    if (error.code === '23505') return { error: 'Ese horario ya está ocupado' }
    return { error: error.message }
  }

  if (booking.contact_id) {
    await supabase.from('contact_activities').insert({
      contact_id: booking.contact_id,
      type: 'note',
      description: 'Cita reprogramada',
      metadata: { booking_id: bookingId, starts_at: startsAt.toISOString() },
    })
  }
  revalidatePath('/calendars')
  revalidatePath('/calendars/bookings')
  return { success: true }
}
