import { Download, CalendarPlus, Mail, StickyNote, FileInput, Zap, Circle } from 'lucide-react'
import type { ContactActivity, ContactActivityType } from '../types'

const ICONS: Record<ContactActivityType, typeof Circle> = {
  imported: Download,
  booking_created: CalendarPlus,
  email_sent: Mail,
  form_submitted: FileInput,
  enrolled: Zap,
  note: StickyNote,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ActivityTimeline({ activities }: { activities: ContactActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted">Sin actividad todavía.</p>
  }

  return (
    <ol className="space-y-4">
      {activities.map((a) => {
        const Icon = ICONS[a.type] ?? Circle
        return (
          <li key={a.id} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon size={15} />
            </div>
            <div>
              <p className="text-sm">{a.description ?? a.type}</p>
              <p className="text-xs text-muted">{formatDate(a.created_at)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
