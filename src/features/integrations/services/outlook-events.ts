import { z } from 'zod'
import { getOutlookAccessToken } from './outlook-auth'

/**
 * Eventos del calendario de Outlook elegido para la vista semanal de Agenda
 * (con asunto, a diferencia del free/busy del motor de reservas).
 * FAIL-OPEN: null = sin conexión activa; [] = semana sin eventos o error puntual.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const TIMEOUT_MS = 5_000
const MAX_PAGES = 5

const eventsSchema = z.object({
  value: z.array(
    z.object({
      subject: z.string().nullish(),
      start: z.object({ dateTime: z.string() }),
      end: z.object({ dateTime: z.string() }),
      showAs: z.string().nullish(),
      isCancelled: z.boolean().nullish(),
      isAllDay: z.boolean().nullish(),
    })
  ),
  '@odata.nextLink': z.string().optional(),
})

export interface OutlookEvent {
  subject: string
  startsAt: string // UTC ISO
  endsAt: string // UTC ISO
  showAs: string // busy | tentative | oof | free | workingElsewhere
  isAllDay: boolean
}

function toUtcIso(graphDateTime: string): string {
  const withZone = graphDateTime.endsWith('Z') ? graphDateTime : `${graphDateTime}Z`
  return new Date(withZone).toISOString()
}

export async function getOutlookWeekEvents(from: Date, to: Date): Promise<OutlookEvent[] | null> {
  const auth = await getOutlookAccessToken()
  if (!auth) return null

  const base = auth.calendarId
    ? `${GRAPH_BASE}/me/calendars/${encodeURIComponent(auth.calendarId)}/calendarView`
    : `${GRAPH_BASE}/me/calendarView`

  let url: string | null =
    `${base}?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}` +
    `&$select=subject,start,end,showAs,isCancelled,isAllDay&$orderby=start/dateTime&$top=100`

  const events: OutlookEvent[] = []
  try {
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return events

      const parsed = eventsSchema.safeParse(await res.json())
      if (!parsed.success) return events

      for (const ev of parsed.data.value) {
        if (ev.isCancelled) continue
        events.push({
          subject: ev.subject?.trim() || '(sin título)',
          startsAt: toUtcIso(ev.start.dateTime),
          endsAt: toUtcIso(ev.end.dateTime),
          showAs: ev.showAs ?? 'busy',
          isAllDay: ev.isAllDay ?? false,
        })
      }
      url = parsed.data['@odata.nextLink'] ?? null
    }
    return events
  } catch {
    return events
  }
}
