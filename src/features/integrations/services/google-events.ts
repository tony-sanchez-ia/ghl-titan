import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getGoogleAccessToken } from './google-auth'

/**
 * Eventos en el Google Calendar del admin (calendario 'primary', por cita).
 * FAIL-OPEN estricto: cualquier fallo devuelve null/void y se loguea — una
 * caída de Google JAMÁS rompe una reserva. sendUpdates=none en TODAS las
 * llamadas: los emails al prospecto los manda Titan vía Resend, no Google.
 */

const EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TIMEOUT_MS = 5_000

const insertResponseSchema = z.object({
  id: z.string(),
  hangoutLink: z.string().optional(),
})

export interface GoogleEventInput {
  summary: string
  description: string
  startsAtIso: string
  endsAtIso: string
  attendeeEmail: string
  attendeeName: string
  withMeet: boolean
}

/**
 * Crea el evento de una reserva. Con withMeet pide un Meet único
 * (conferenceDataVersion=1 obligatorio o Google ignora la petición en silencio).
 */
export async function createGoogleEvent(
  input: GoogleEventInput
): Promise<{ eventId: string; meetLink: string | null } | null> {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return null

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAtIso },
    end: { dateTime: input.endsAtIso },
    attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
  }
  if (input.withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(), // único por cita (en servidor randomUUID siempre existe)
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  try {
    const res = await fetch(`${EVENTS_BASE}?conferenceDataVersion=1&sendUpdates=none`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error('[google] events.insert falló:', res.status, await res.text())
      return null
    }
    const parsed = insertResponseSchema.safeParse(await res.json())
    if (!parsed.success) return null
    return { eventId: parsed.data.id, meetLink: parsed.data.hangoutLink ?? null }
  } catch (e) {
    console.error('[google] events.insert error:', (e as Error).message)
    return null
  }
}

/** Mueve el evento a la nueva hora (el Meet no cambia). 404/410 = ya no existe, nada que mover. */
export async function moveGoogleEvent(
  eventId: string,
  startsAtIso: string,
  endsAtIso: string
): Promise<void> {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return

  try {
    const res = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: { dateTime: startsAtIso },
        end: { dateTime: endsAtIso },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error('[google] events.patch falló:', res.status, await res.text())
    }
  } catch (e) {
    console.error('[google] events.patch error:', (e as Error).message)
  }
}

/** Borra el evento de una cita cancelada. 404/410 = ya estaba borrado, éxito. */
export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) return

  try {
    const res = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error('[google] events.delete falló:', res.status, await res.text())
    }
  } catch (e) {
    console.error('[google] events.delete error:', (e as Error).message)
  }
}
