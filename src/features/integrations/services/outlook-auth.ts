import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { encryptToken, decryptToken } from './token-crypto'
import type { IntegrationConnection } from '@/types/database'

/**
 * OAuth device code flow contra Microsoft identity platform (sin librería).
 * Cliente PÚBLICO: solo client_id, sin secret ni redirect URI.
 * SOLO servidor (tokens + BD).
 */

const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const SCOPES = 'offline_access User.Read Calendars.Read'
const AUTH_TIMEOUT_MS = 10_000

export function getMicrosoftClientId(): string | null {
  return process.env.MICROSOFT_CLIENT_ID || null
}

// ─── Esquemas de respuesta de Microsoft ──────────────────────────────────────

const deviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number().default(5),
})

const tokenSuccessSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
})

const tokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
})

// ─── Device code flow ────────────────────────────────────────────────────────

export interface DeviceCodeStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

/** Pide a Microsoft un código de dispositivo para iniciar el enlace. */
export async function requestDeviceCode(): Promise<
  { data: DeviceCodeStart } | { error: string }
> {
  const clientId = getMicrosoftClientId()
  if (!clientId) return { error: 'MICROSOFT_CLIENT_ID no configurado' }

  try {
    const res = await fetch(`${AUTH_BASE}/devicecode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, scope: SCOPES }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    const json = await res.json()
    if (!res.ok) {
      const err = tokenErrorSchema.safeParse(json)
      return { error: err.success ? err.data.error : 'Microsoft no respondió correctamente' }
    }
    const parsed = deviceCodeSchema.safeParse(json)
    if (!parsed.success) return { error: 'Respuesta inesperada de Microsoft' }
    const d = parsed.data
    return {
      data: {
        deviceCode: d.device_code,
        userCode: d.user_code,
        verificationUri: d.verification_uri,
        expiresIn: d.expires_in,
        interval: d.interval,
      },
    }
  } catch {
    return { error: 'No se pudo contactar con Microsoft' }
  }
}

export type RedeemResult =
  | { status: 'connected'; email: string }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'expired' }
  | { status: 'declined' }
  | { status: 'error'; error: string }

/**
 * Un intento de canje del device_code por tokens (se llama en cada tick de polling).
 * Al conseguirlos: guarda la conexión (refresh token cifrado) y preselecciona
 * el calendario predeterminado de Outlook.
 */
export async function redeemDeviceCode(deviceCode: string): Promise<RedeemResult> {
  const clientId = getMicrosoftClientId()
  if (!clientId) return { status: 'error', error: 'MICROSOFT_CLIENT_ID no configurado' }

  let json: unknown
  let ok: boolean
  try {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: deviceCode,
      }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    json = await res.json()
    ok = res.ok
  } catch {
    // Red caída en este tick: se reintenta en el siguiente
    return { status: 'pending' }
  }

  if (!ok) {
    const err = tokenErrorSchema.safeParse(json)
    if (!err.success) return { status: 'error', error: 'Respuesta inesperada de Microsoft' }
    switch (err.data.error) {
      case 'authorization_pending':
        return { status: 'pending' }
      case 'slow_down':
        return { status: 'slow_down' }
      case 'expired_token':
        return { status: 'expired' }
      case 'authorization_declined':
        return { status: 'declined' }
      default:
        return { status: 'error', error: err.data.error }
    }
  }

  const tokens = tokenSuccessSchema.safeParse(json)
  if (!tokens.success || !tokens.data.refresh_token) {
    return { status: 'error', error: 'Microsoft no devolvió los tokens esperados' }
  }

  const email = await fetchAccountEmail(tokens.data.access_token)
  const expiresAt = new Date(Date.now() + tokens.data.expires_in * 1000)

  await query(
    `insert into integration_connections
       (provider, account_email, refresh_token_enc, access_token, access_token_expires_at, status)
     values ('outlook', $1, $2, $3, $4, 'connected')
     on conflict (provider) do update set
       account_email = excluded.account_email,
       refresh_token_enc = excluded.refresh_token_enc,
       access_token = excluded.access_token,
       access_token_expires_at = excluded.access_token_expires_at,
       status = 'connected',
       connected_at = now(),
       updated_at = now()`,
    [email, encryptToken(tokens.data.refresh_token), tokens.data.access_token, expiresAt.toISOString()]
  )

  // Preselecciona el calendario predeterminado (si falla, queda null = predeterminado)
  await preselectDefaultCalendar(tokens.data.access_token)

  return { status: 'connected', email }
}

async function fetchAccountEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    if (!res.ok) return ''
    const me = z
      .object({ mail: z.string().nullish(), userPrincipalName: z.string().nullish() })
      .safeParse(await res.json())
    if (!me.success) return ''
    return me.data.mail ?? me.data.userPrincipalName ?? ''
  } catch {
    return ''
  }
}

const calendarsSchema = z.object({
  value: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isDefaultCalendar: z.boolean().optional(),
    })
  ),
})

export interface OutlookCalendar {
  id: string
  name: string
  isDefault: boolean
}

/** Lista los calendarios de la cuenta conectada (para el selector de Ajustes). */
export async function listOutlookCalendars(): Promise<
  { calendars: OutlookCalendar[] } | { error: string }
> {
  const token = await getOutlookAccessToken()
  if (!token) return { error: 'Sin conexión activa con Outlook' }

  try {
    const res = await fetch(`${GRAPH_BASE}/me/calendars?$select=id,name,isDefaultCalendar&$top=50`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    if (!res.ok) return { error: 'Microsoft no devolvió los calendarios' }
    const parsed = calendarsSchema.safeParse(await res.json())
    if (!parsed.success) return { error: 'Respuesta inesperada de Microsoft' }
    return {
      calendars: parsed.data.value.map((c) => ({
        id: c.id,
        name: c.name,
        isDefault: c.isDefaultCalendar ?? false,
      })),
    }
  } catch {
    return { error: 'No se pudo contactar con Microsoft' }
  }
}

async function preselectDefaultCalendar(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me/calendars?$select=id,name,isDefaultCalendar&$top=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    if (!res.ok) return
    const parsed = calendarsSchema.safeParse(await res.json())
    if (!parsed.success) return
    const def = parsed.data.value.find((c) => c.isDefaultCalendar) ?? parsed.data.value[0]
    if (!def) return
    await query(
      `update integration_connections set calendar_id = $1, calendar_name = $2, updated_at = now()
       where provider = 'outlook'`,
      [def.id, def.name]
    )
  } catch {
    /* opcional: sin selección sigue usándose el predeterminado */
  }
}

// ─── Conexión y tokens ───────────────────────────────────────────────────────

/** Datos de la conexión para la UI (sin tokens). */
export async function getOutlookConnection(): Promise<Pick<
  IntegrationConnection,
  'account_email' | 'calendar_id' | 'calendar_name' | 'status' | 'connected_at'
> | null> {
  return queryOne(
    `select account_email, calendar_id, calendar_name, status, connected_at
     from integration_connections where provider = 'outlook'`
  )
}

export async function setOutlookCalendar(calendarId: string, calendarName: string): Promise<void> {
  await query(
    `update integration_connections set calendar_id = $1, calendar_name = $2, updated_at = now()
     where provider = 'outlook'`,
    [calendarId, calendarName]
  )
}

export async function deleteOutlookConnection(): Promise<void> {
  await query(`delete from integration_connections where provider = 'outlook'`)
}

/**
 * Access token válido para llamar a Graph (refresca si caducó, rotando el
 * refresh token — Microsoft emite uno nuevo en cada refresh y hay que guardarlo).
 * Devuelve null si no hay conexión, requiere re-autorización, o Microsoft falla.
 */
export async function getOutlookAccessToken(): Promise<{
  accessToken: string
  calendarId: string | null
} | null> {
  const conn = await queryOne<IntegrationConnection>(
    `select * from integration_connections where provider = 'outlook'`
  )
  if (!conn || conn.status !== 'connected') return null

  const stillValid =
    conn.access_token &&
    conn.access_token_expires_at &&
    new Date(conn.access_token_expires_at).getTime() > Date.now() + 120_000
  if (stillValid) {
    return { accessToken: conn.access_token!, calendarId: conn.calendar_id }
  }

  const refreshToken = decryptToken(conn.refresh_token_enc)
  if (!refreshToken) {
    await markReauthRequired()
    return null
  }

  const clientId = getMicrosoftClientId()
  if (!clientId) return null

  let json: unknown
  let ok: boolean
  try {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
        scope: SCOPES,
      }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    json = await res.json()
    ok = res.ok
  } catch {
    return null // fallo transitorio de red: NO invalidar la conexión
  }

  if (!ok) {
    const err = tokenErrorSchema.safeParse(json)
    if (err.success && err.data.error === 'invalid_grant') {
      await markReauthRequired()
    }
    return null
  }

  const tokens = tokenSuccessSchema.safeParse(json)
  if (!tokens.success) return null

  const expiresAt = new Date(Date.now() + tokens.data.expires_in * 1000)
  await query(
    `update integration_connections set
       access_token = $1,
       access_token_expires_at = $2,
       refresh_token_enc = coalesce($3, refresh_token_enc),
       updated_at = now()
     where provider = 'outlook'`,
    [
      tokens.data.access_token,
      expiresAt.toISOString(),
      tokens.data.refresh_token ? encryptToken(tokens.data.refresh_token) : null,
    ]
  )

  return { accessToken: tokens.data.access_token, calendarId: conn.calendar_id }
}

async function markReauthRequired(): Promise<void> {
  await query(
    `update integration_connections set status = 'reauth_required', updated_at = now()
     where provider = 'outlook'`
  )
}
