import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { Calendar, GraduationCap, Mail } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { ContactRelated as Related } from '../services/contacts'

const TZ = 'Europe/Madrid'

function fmt(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'd MMM yyyy, HH:mm', { locale: es })
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  pending: 'Pendiente',
  sent: 'Enviado',
  failed: 'Falló',
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'confirmed' || status === 'sent'
  const bad = status === 'cancelled' || status === 'failed'
  const cls = ok
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : bad
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-bg text-muted'
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{STATUS_LABEL[status] ?? status}</span>
}

export function ContactRelated({ related }: { related: Related }) {
  const { bookings, enrollments, scheduledEmails } = related

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Citas */}
      <div className={`${ui.card} p-5`}>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar size={16} /> Citas</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">Sin citas.</p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => (
              <li key={b.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="capitalize">{fmt(b.starts_at)}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-muted text-xs">{b.calendarName ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cursos */}
      <div className={`${ui.card} p-5`}>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><GraduationCap size={16} /> Cursos</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted">No está inscrito en cursos.</p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((e) => {
              const pct = e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0
              return (
                <li key={e.id} className="text-sm">
                  <p className="font-medium">{e.courseTitle}</p>
                  <div className="h-1.5 rounded-full bg-bg overflow-hidden mt-1">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-muted text-xs mt-1">{e.completed}/{e.total} lecciones ({pct}%)</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Emails de secuencia */}
      <div className={`${ui.card} p-5`}>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Mail size={16} /> Emails de secuencia</h2>
        {scheduledEmails.length === 0 ? (
          <p className="text-sm text-muted">Sin emails programados.</p>
        ) : (
          <ul className="space-y-3">
            {scheduledEmails.map((m) => (
              <li key={m.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{m.subject}</span>
                  <StatusBadge status={m.status} />
                </div>
                <p className="text-muted text-xs capitalize">{fmt(m.send_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
