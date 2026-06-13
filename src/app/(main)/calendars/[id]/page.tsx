import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCalendarById } from '@/features/scheduling/services/calendars'
import { CalendarForm } from '@/features/scheduling/components/CalendarForm'
import { AvailabilityEditor } from '@/features/scheduling/components/AvailabilityEditor'
import { CopyLinkButton, DeleteCalendarButton } from '@/features/scheduling/components/CalendarActions'

export default async function EditCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const calendar = await getCalendarById(id)
  if (!calendar) notFound()

  return (
    <div className="space-y-6">
      <Link href="/calendars" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Agenda
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{calendar.name}</h1>
        <div className="flex items-center gap-2">
          <CopyLinkButton slug={calendar.slug} />
          <DeleteCalendarButton id={calendar.id} />
        </div>
      </div>

      <AvailabilityEditor calendarId={calendar.id} initial={calendar.availability} />

      <div>
        <h2 className="font-semibold mb-3">Configuración</h2>
        <CalendarForm calendar={calendar} />
      </div>
    </div>
  )
}
