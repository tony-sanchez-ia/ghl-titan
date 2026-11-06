import { stepCountIs, streamText } from 'ai'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { aiAvailable, assistantModel, getOpenRouter } from '@/lib/ai/openrouter'
import { buildSystemPrompt } from '@/features/assistant/services/prompt'
import { assistantTools } from '@/features/assistant/services/tools'

// Los /api/* no pasan por la protección del proxy: la sesión se valida aquí.

/** Límite por mensaje: cabe una descripción de marca o un texto largo pegado para reescribir. */
const MAX_MESSAGE_CHARS = 30000
/** Solo se manda al modelo el final de la conversación (las conversaciones largas no se bloquean). */
const MAX_HISTORY = 40

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1),
})

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return new Response('No autorizado', { status: 401 })
  if (!aiAvailable()) {
    return new Response('La IA no está configurada (falta OPENROUTER_API_KEY)', { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === 'too_big')
    return new Response(
      tooLong
        ? `un mensaje supera ${MAX_MESSAGE_CHARS.toLocaleString('es-ES')} caracteres; divídelo en partes`
        : 'Petición inválida',
      { status: 400 }
    )
  }
  // El historial debe empezar por un mensaje del usuario
  let messages = parsed.data.messages.slice(-MAX_HISTORY)
  while (messages.length > 1 && messages[0].role !== 'user') messages = messages.slice(1)

  const result = streamText({
    model: getOpenRouter()(assistantModel()),
    system: await buildSystemPrompt(),
    messages,
    tools: assistantTools,
    stopWhen: stepCountIs(8),
  })

  return result.toTextStreamResponse()
}
