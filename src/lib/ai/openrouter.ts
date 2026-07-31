import { createOpenRouter } from '@openrouter/ai-sdk-provider'

/**
 * Proveedor OpenRouter para el AI SDK. SOLO servidor.
 * Sin OPENROUTER_API_KEY las features de IA se desactivan (aiAvailable).
 */
export function aiAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export function getOpenRouter() {
  return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! })
}

/** Modelo para generación de páginas (estructurada). Configurable por env. */
export function aiModel(): string {
  return process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5'
}

/** Modelo del Asistente IA de copywriting. Configurable por env. */
export function assistantModel(): string {
  return process.env.OPENROUTER_ASSISTANT_MODEL || 'anthropic/claude-sonnet-4.6'
}
