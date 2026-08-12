import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  buildGoogleAuthUrl,
  isGoogleConfigured,
  getPanelBaseUrl,
  GOOGLE_STATE_COOKIE,
} from '@/features/integrations/services/google-auth'

export const dynamic = 'force-dynamic'

/**
 * Inicia el enlace con Google: exige sesión de admin (los /api/* NO pasan por
 * proxy.ts), siembra el state anti-CSRF en cookie httpOnly y redirige al
 * consentimiento. El flujo entero vive en el MISMO origen (cookie de state).
 */
export async function GET(request: Request) {
  const base = getPanelBaseUrl(request.url)
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(`${base}/login`)
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${base}/settings?google=config`)
  }

  const state = randomBytes(24).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })

  return NextResponse.redirect(buildGoogleAuthUrl(state))
}
