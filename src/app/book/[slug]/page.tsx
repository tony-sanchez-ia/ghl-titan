import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicCalendarBySlug } from '@/features/scheduling/services/calendars'
import { generateSlots } from '@/features/scheduling/services/availability'
import { BookingFlow } from '@/features/scheduling/components/BookingFlow'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicCalendarBySlug(slug)
  return { title: data ? `Reservar — ${data.calendar.name}` : 'Reservar' }
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getPublicCalendarBySlug(slug)
  if (!data) notFound()

  const days = generateSlots(data.calendar, data.availability, data.bookings)

  return (
    <div className="min-h-screen py-10 px-4">
      <BookingFlow
        calendar={{
          slug: data.calendar.slug,
          name: data.calendar.name,
          description: data.calendar.description,
          duration_min: data.calendar.duration_min,
          location_type: data.calendar.location_type,
        }}
        days={days}
      />
      <p className="text-center text-xs text-muted mt-6">
        Powered by GHL Titan
      </p>
    </div>
  )
}
