import { stepCountIs, streamText } from 'ai'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { aiAvailable, assistantModel, getOpenRouter } from '@/lib/ai/openrouter'
import { buildSystemPrompt } from '@/features/assistant/services/prompt'
import { assistantTools } from '@/features/assistant/services/tools'

// Los /api/* no pasan por la protección del proxy: la sesión se valida aquí.

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(60),
})

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return new Response('No autorizado', { status: 401 })
  if (!aiAvailable()) {
    return new Response('La IA no está configurada (falta OPENROUTER_API_KEY)', { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return new Response('Petición inválida', { status: 400 })

  const result = streamText({
    model: getOpenRouter()(assistantModel()),
    system: await buildSystemPrompt(),
    messages: parsed.data.messages,
    tools: assistantTools,
    stopWhen: stepCountIs(8),
  })

  return result.toTextStreamResponse()
}
