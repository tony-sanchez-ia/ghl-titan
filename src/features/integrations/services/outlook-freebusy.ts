import { z } from 'zod'
import { getOutlookAccessToken } from './outlook-auth'

/**
 * Free/busy del calendario de Outlook elegido, vía calendarView de Microsoft
 * Graph (expande eventos recurrentes). Devuelve intervalos {starts_at, ends_at}
 * en UTC listos para fusionar con las citas antes de generateSlots.
 *
 * FAIL-OPEN: ante cualquier fallo (sin conexión, timeout, Microsoft caído)
 * devuelve [] — la agenda nunca se cae por Microsoft.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const TIMEOUT_MS = 5_000
const MAX_PAGES = 10

// Decisión de Tony (2026-07-10): solo 'busy' y 'oof' bloquean;
// tentative/free/workingElsewhere NO bloquean.
const BLOCKING_STATUSES = new Set(['busy', 'oof'])

const eventsSchema = z.object({
  value: z.array(
    z.object({
      start: z.object({ dateTime: z.string() }),
      end: z.object({ dateTime: z.string() }),
      showAs: z.string().nullish(),
      isCancelled: z.boolean().nullish(),
    })
  ),
  '@odata.nextLink': z.string().optional(),
})

export interface BusyInterval {
  starts_at: string
  ends_at: string
}

/** Con Prefer outlook.timezone=UTC, Graph devuelve dateTime SIN sufijo de zona. */
function toUtcIso(graphDateTime: string): string {
  const withZone = graphDateTime.endsWith('Z') ? graphDateTime : `${graphDateTime}Z`
  return new Date(withZone).toISOString()
}

/**
 * Intervalos ocupados de Outlook desde ahora hasta el fin de la ventana
 * reservable (+2 días de margen por zonas horarias).
 */
export async function getOutlookBusyIntervals(windowDays: number): Promise<BusyInterval[]> {
  const auth = await getOutlookAccessToken()
  if (!auth) return []

  const from = new Date()
  const to = new Date(Date.now() + (windowDays + 2) * 86_400_000)
  const base = auth.calendarId
    ? `${GRAPH_BASE}/me/calendars/${encodeURIComponent(auth.calendarId)}/calendarView`
    : `${GRAPH_BASE}/me/calendarView`

  let url: string | null =
    `${base}?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}` +
    `&$select=start,end,showAs,isCancelled&$top=100`

  const intervals: BusyInterval[] = []
  try {
    // calendarView pagina: seguir @odata.nextLink o se pierden eventos
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return intervals

      const parsed = eventsSchema.safeParse(await res.json())
      if (!parsed.success) return intervals

      for (const ev of parsed.data.value) {
        if (ev.isCancelled) continue
        if (!BLOCKING_STATUSES.has(ev.showAs ?? 'busy')) continue
        intervals.push({
          starts_at: toUtcIso(ev.start.dateTime),
          ends_at: toUtcIso(ev.end.dateTime),
        })
      }
      url = parsed.data['@odata.nextLink'] ?? null
    }
    return intervals
  } catch {
    return intervals
  }
}
