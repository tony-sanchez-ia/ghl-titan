import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { recordFormView } from '@/features/forms/services/tracking'

export const dynamic = 'force-dynamic'

const schema = z.object({
  form_id: z.string().uuid(),
  visitor_id: z.string().min(1).max(64),
})

/**
 * Registra una VISTA de formulario (público, embebible). El visitante lo genera
 * el cliente (localStorage) porque el iframe puede vivir en cualquier dominio.
 * Nunca rompe la página: cualquier problema devuelve ok.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: true })

  try {
    await recordFormView(parsed.data.form_id, parsed.data.visitor_id)
  } catch {
    /* medición best-effort */
  }
  return NextResponse.json({ ok: true })
}
