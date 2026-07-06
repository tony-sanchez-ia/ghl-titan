import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { recordEvent, VISITOR_COOKIE } from '@/features/funnels/services/tracking'

export const dynamic = 'force-dynamic'

const eventSchema = z.object({
  step_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  type: z.enum(['cta_click', 'form_submit']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Eventos de interacción de las páginas públicas de funnel (cta_click, form_submit).
 * El visitante viene de la cookie tv_id (la pone proxy.ts). Sin cookie no se registra
 * (no rompemos la página por un bloqueador).
 */
export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  if (!visitorId || visitorId.length > 64) return NextResponse.json({ ok: true })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  // metadata acotada: solo claves simples y tamaño limitado
  const metadata = parsed.data.metadata ?? {}
  if (JSON.stringify(metadata).length > 2000)
    return NextResponse.json({ error: 'Metadata demasiado grande' }, { status: 400 })

  await recordEvent({
    stepId: parsed.data.step_id,
    variantId: parsed.data.variant_id ?? null,
    visitorId,
    type: parsed.data.type,
    metadata,
  })
  return NextResponse.json({ ok: true })
}
