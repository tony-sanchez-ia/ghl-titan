import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt'

/** Primeros segmentos de ruta que NUNCA son una página pública en dominio propio. */
const RESERVED_SEGMENTS = new Set([
  'api', 'login', 'signup', 'dashboard', 'contacts', 'calendars', 'courses',
  'automations', 'marketing', 'funnels', 'forms', 'settings', 'book', 'form', 'learn',
  'unsubscribe', 'p', 'r', 'e', 'sites', 'websites', 'w', 'assistant',
])

const VISITOR_COOKIE_OPTS = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  httpOnly: true,
  path: '/',
}

function newVisitorId(): string {
  // En el servidor crypto.randomUUID siempre existe (el gotcha LAN es solo del browser)
  return crypto.randomUUID().replace(/-/g, '')
}

/** El dominio "principal" (panel + /p): NEXT_PUBLIC_SITE_URL, localhost o una IP. */
function isMainHost(hostHeader: string): boolean {
  const host = hostHeader.split(':')[0].toLowerCase()
  if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  try {
    return host === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').hostname.toLowerCase()
  } catch {
    return false
  }
}

/**
 * En un dominio propio solo se sirven páginas de funnel: la raíz o un primer
 * segmento no reservado y sin extensión. El resto (api, form, r, assets…)
 * sigue su flujo normal sea cual sea el dominio.
 */
function isFunnelPathOnCustomDomain(pathname: string): boolean {
  if (pathname === '/') return true
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 1 && !RESERVED_SEGMENTS.has(segments[0]) && !segments[0].includes('.')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Multidominio: dominios de cliente (EasyPanel/Traefik) → rewrite interno ──
  const host = request.headers.get('host') ?? ''
  if (host && !isMainHost(host) && isFunnelPathOnCustomDomain(pathname)) {
    const cleanHost = host.split(':')[0].toLowerCase()
    const target = new URL(`/sites/${cleanHost}${pathname === '/' ? '' : pathname}`, request.url)

    const visitorId = request.cookies.get('tv_id')?.value
    if (visitorId) return NextResponse.rewrite(target)

    // 1ª visita: cookie nueva + header interno para que el RSC registre el page_view
    const id = newVisitorId()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tv-id', id)
    const response = NextResponse.rewrite(target, { request: { headers: requestHeaders } })
    response.cookies.set('tv_id', id, VISITOR_COOKIE_OPTS)
    return response
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null

  // Rutas protegidas
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/calendars') ||
    pathname.startsWith('/courses') ||
    pathname.startsWith('/automations') ||
    pathname.startsWith('/marketing') ||
    pathname.startsWith('/assistant') ||
    pathname.startsWith('/funnels') ||
    pathname.startsWith('/forms') ||
    pathname.startsWith('/websites') ||
    pathname.startsWith('/settings')
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Cookie anónima de visitante en páginas públicas de funnel del dominio principal
  if (pathname.startsWith('/p/') && !request.cookies.get('tv_id')) {
    const id = newVisitorId()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tv-id', id)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.cookies.set('tv_id', id, VISITOR_COOKIE_OPTS)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
