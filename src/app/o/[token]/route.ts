import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GIF transparente 1×1
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * Píxel de apertura: /o/[token] (mismo click_token de campañas y automatizaciones).
 * Marca opened_at solo la primera vez. SIEMPRE responde el GIF —aunque el token no
 * exista o falle la BD— para que el email nunca muestre una imagen rota.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const hit = await query(
      'update campaign_recipients set opened_at = now() where click_token = $1 and opened_at is null returning id',
      [token]
    )
    if (hit.length === 0) {
      await query(
        'update scheduled_emails set opened_at = now() where click_token = $1 and opened_at is null',
        [token]
      )
    }
  } catch {
    /* el píxel no debe fallar nunca */
  }
  return new Response(new Uint8Array(PIXEL), {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  })
}
