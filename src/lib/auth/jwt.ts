import { SignJWT, jwtVerify } from 'jose'

/**
 * Firma y verificación del token de sesión (JWT HS256).
 * Separado de session.ts para poder usarse también en el proxy (edge).
 */

export type SessionPayload = {
  sub: string // user id
  email: string
  name: string | null
}

const SESSION_DURATION_DAYS = 30

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET no configurado')
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setSubject(payload.sub)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    return {
      sub: payload.sub,
      email: (payload.email as string) ?? '',
      name: (payload.name as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60
