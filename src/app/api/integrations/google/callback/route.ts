import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  redeemGoogleCode,
  getPanelBaseUrl,
  GOOGLE_STATE_COOKIE,
} from '@/features/integrations/services/google-auth'

export const dynamic = 'force-dynamic'

/**
 * Aterrizaje del consentimiento de Google. Valida sesión + state (la ruta es
 * pública: /api/* no pasa por proxy.ts) y canjea el code por tokens.
 * Siempre termina redirigiendo a Ajustes con ?google=<resultado>.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const base = getPanelBaseUrl(request.url)
  const settingsUrl = (result: string) => `${base}/settings?google=${result}`

  const session = await getSession()
  if (!session) return NextResponse.redirect(`${base}/login`)

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value
  cookieStore.delete(GOOGLE_STATE_COOKIE)

  // El usuario canceló en la pantalla de Google
  if (url.searchParams.get('error')) {
    return NextResponse.redirect(settingsUrl('declined'))
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl('state_error'))
  }

  const result = await redeemGoogleCode(code)
  if ('error' in result) {
    console.error('[google] fallo canjeando el code:', result.error)
    return NextResponse.redirect(settingsUrl('error'))
  }

  return NextResponse.redirect(settingsUrl('connected'))
}
