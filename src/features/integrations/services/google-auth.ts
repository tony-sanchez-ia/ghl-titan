import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { encryptToken, decryptToken } from './token-crypto'
import type { IntegrationConnection } from '@/types/database'

/**
 * OAuth authorization code flow contra Google (sin librería). Cliente CONFIDENCIAL:
 * client_id + client_secret + redirect URI (el device flow de Google no admite
 * scopes de Calendar, al revés que la integración de Outlook). SOLO servidor.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
// openid+email son scopes básicos (no amplían la pantalla de consentimiento):
// solo para mostrar la cuenta conectada en la card de Ajustes.
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events'
const AUTH_TIMEOUT_MS = 10_000

/** Cookie del state anti-CSRF (la comparten las rutas start y callback). */
export const GOOGLE_STATE_COOKIE = 'google_oauth_state'

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || null
}

function getGoogleClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET || null
}

export function isGoogleConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret())
}

/**
 * Origen del panel: base de TODAS las redirecciones del flujo OAuth. No usar
 * request.url para construirlas — Next normaliza su host (p.ej. a localhost)
 * y un redirect a otro host pierde las cookies de sesión y de state.
 */
export function getPanelBaseUrl(fallback: string): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || fallback).replace(/\/$/, '')
}

/** El callback DEBE vivir en el mismo origen donde empieza el flujo (cookie de state). */
export function getGoogleRedirectUri(): string {
  return `${getPanelBaseUrl('')}/api/integrations/google/callback`
}

// ─── Esquemas de respuesta de Google ─────────────────────────────────────────

const tokenSuccessSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  id_token: z.string().optional(),
})

const tokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
})

// ─── Flujo de autorización ───────────────────────────────────────────────────

/** URL de consentimiento. access_type=offline + prompt=consent o Google NO devuelve refresh token. */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId() ?? '',
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

/**
 * Canjea el code del callback por tokens y guarda la conexión
 * (refresh token cifrado, fila provider='google').
 */
export async function redeemGoogleCode(
  code: string
): Promise<{ email: string } | { error: string }> {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) return { error: 'GOOGLE_CLIENT_ID/SECRET no configurados' }

  let json: unknown
  let ok: boolean
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleRedirectUri(),
      }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
    json = await res.json()
    ok = res.ok
  } catch {
    return { error: 'No se pudo contactar con Google' }
  }

  if (!ok) {
    const err = tokenErrorSchema.safeParse(json)
    return { error: err.success ? err.data.error : 'Google no respondió correctamente' }
  }

  const tokens = tokenSuccessSchema.safeParse(json)
  if (!tokens.success || !tokens.data.refresh_token) {
    return { error: 'Google no devolvió los tokens esperados' }
  }

  const email = emailFromIdToken(tokens.data.id_token)
  const expiresAt = new Date(Date.now() + tokens.data.expires_in * 1000)

  await query(
    `insert into integration_connections
       (provider, account_email, refresh_token_enc, access_token, access_token_expires_at, status)
     values ('google', $1, $2, $3, $4, 'connected')
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

  return { email }
}

/**
 * Email de la cuenta desde el id_token, solo informativo para la card.
 * Sin verificar firma: el token llega directo del endpoint de Google por TLS.
 */
function emailFromIdToken(idToken: string | undefined): string {
  if (!idToken) return ''
  try {
    const payload = idToken.split('.')[1]
    const claims = z
      .object({ email: z.string().optional() })
      .safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
    return claims.success ? (claims.data.email ?? '') : ''
  } catch {
    return ''
  }
}

// ─── Conexión y tokens ───────────────────────────────────────────────────────

/** Datos de la conexión para la UI (sin tokens). */
export async function getGoogleConnection(): Promise<Pick<
  IntegrationConnection,
  'account_email' | 'status' | 'connected_at'
> | null> {
  return queryOne(
    `select account_email, status, connected_at
     from integration_connections where provider = 'google'`
  )
}

export async function deleteGoogleConnection(): Promise<void> {
  await query(`delete from integration_connections where provider = 'google'`)
}

/**
 * Access token válido para llamar a Calendar API (refresca si caducó).
 * A diferencia de Microsoft, los refresh tokens de Google NO rotan (si llega
 * uno nuevo por re-consent, se guarda). Devuelve null si no hay conexión,
 * requiere re-autorización, o Google falla (fail-open).
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const conn = await queryOne<IntegrationConnection>(
    `select * from integration_connections where provider = 'google'`
  )
  if (!conn || conn.status !== 'connected') return null

  const stillValid =
    conn.access_token &&
    conn.access_token_expires_at &&
    new Date(conn.access_token_expires_at).getTime() > Date.now() + 120_000
  if (stillValid) return conn.access_token!

  const refreshToken = decryptToken(conn.refresh_token_enc)
  if (!refreshToken) {
    await markReauthRequired()
    return null
  }

  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) return null

  let json: unknown
  let ok: boolean
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
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
     where provider = 'google'`,
    [
      tokens.data.access_token,
      expiresAt.toISOString(),
      tokens.data.refresh_token ? encryptToken(tokens.data.refresh_token) : null,
    ]
  )

  return tokens.data.access_token
}

async function markReauthRequired(): Promise<void> {
  await query(
    `update integration_connections set status = 'reauth_required', updated_at = now()
     where provider = 'google'`
  )
}
