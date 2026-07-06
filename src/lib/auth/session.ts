import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from './jwt'

/** Crea la sesión: firma el JWT y lo guarda en cookie httpOnly. */
export async function createSession(user: { id: string; email: string; full_name: string | null }) {
  const token = await signSessionToken({ sub: user.id, email: user.email, name: user.full_name })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}

/** Devuelve la sesión actual o null. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/** Borra la cookie de sesión. */
export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
