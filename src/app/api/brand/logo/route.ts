import { queryOne } from '@/lib/db'

/**
 * Logo de la instancia (bytes en BD). Público: lo usa también la pantalla de login.
 * La URL lleva ?v=<logo_updated_at> → caché inmutable; al subir otro logo cambia la URL.
 * CSP + nosniff: un SVG abierto directamente no puede ejecutar scripts.
 */
export async function GET() {
  const row = await queryOne<{ logo_data: Buffer; logo_mime: string }>(
    'select logo_data, logo_mime from instance_settings where id = true and logo_data is not null'
  )
  if (!row) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(row.logo_data), {
    headers: {
      'Content-Type': row.logo_mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
