import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CalendarForm } from '@/features/scheduling/components/CalendarForm'

export default function NewCalendarPage() {
  return (
    <div className="space-y-6">
      <Link href="/calendars" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Agenda
      </Link>
      <h1 className="text-2xl font-bold">Nuevo calendario</h1>
      <CalendarForm />
    </div>
  )
}
