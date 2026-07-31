# PRP-015: Asistente IA de Copywriting (agente con Vercel AI SDK)

> Estado: EN EJECUCIÓN (2026-07-30). Decisiones de Tony: dentro del panel · borradores
> reales en Marketing · memoria auto-aprendida + editable · SOLO borradores (nunca envía).

## Objetivo
Sección **Asistente IA** en el panel: un chat que conoce GHL Titan (contactos,
actividad, campañas), escribe copy de newsletters, crea **borradores reales** en
Marketing → Campañas, y mantiene una **memoria de marca persistente** (consultable,
editable y reseteable) que se inyecta en el contexto de cada conversación.

## Modelo
`anthropic/claude-sonnet-4.6` vía OpenRouter (verificado: existe, $3/$15 por MTok).
Configurable con env `OPENROUTER_ASSISTANT_MODEL`. Reutiliza `OPENROUTER_API_KEY`.

## Arquitectura
- **BD** (migración `0011_assistant_memory.sql`): tabla `assistant_memories`
  (id, content, source 'agent'|'user', created_at). Sin RLS (patrón Neon post-migración).
- **Feature** `src/features/assistant/`:
  - `services/memory.ts` — CRUD memoria + `buildMemoryContext()`.
  - `services/tools.ts` — herramientas del agente (ai `tool()` + zod):
    `resumen_audiencia`, `buscar_contactos`, `ver_contacto`, `listar_campanas`,
    `ver_campana`, `crear_borrador_newsletter`, `guardar_memoria`.
  - `services/prompt.ts` — system prompt (persona copywriter + memoria inyectada).
  - `components/AssistantChat.tsx` — chat cliente (fetch + stream de texto, sin deps nuevas).
  - `components/MemoryPanel.tsx` — ver/editar/borrar/resetear memoria.
- **API** `src/app/api/assistant/chat/route.ts` — `streamText` multi-step
  (`stopWhen: stepCountIs(8)`), auth con `getSession()` (los /api/* no pasan por proxy),
  respuesta `toTextStreamResponse()`.
- **Página** `src/app/(main)/assistant/page.tsx` + entrada sidebar "Asistente IA"
  (icono Sparkles) + `/assistant` en proxy (protegida + RESERVED_SEGMENTS).
- **Actions** `src/actions/assistant.ts` — gestión de memoria desde la UI.

## Decisiones técnicas
- **Sin `@ai-sdk/react`**: el cliente lee el stream de texto plano con
  `response.body.getReader()`. Los tool-calls ocurren en servidor entre deltas.
- **Borradores**: el tool recibe bloques simples tipados
  (`titular`/`texto`/`boton`) y los mapea a `EmailDesign` V2 con `newSection('1', ...)`
  + header y footer automáticos. Texto SIEMPRE plano (`config.text`) — el render lo
  escapa; la IA nunca produce HTML (mismo principio que ai-generate de funnels).
- **Estado**: siempre `status='draft'`. NO existe herramienta de envío (decisión Tony).
- **Memoria en contexto**: todas las entradas (cap 100 / 12k chars) van al system
  prompt en cada request. El historial de chat NO persiste (V1, KISS).

## Fases
1. Migración BD → verificar: tabla existe en Neon.
2. Servicios + tools → verificar: `npx tsc --noEmit`.
3. API route → verificar: responde (401 sin sesión).
4. UI + sidebar + proxy → verificar: build OK.
5. E2E browser (`next start`): chat responde con datos reales, crea borrador visible
   en /marketing, memoria se guarda/edita/resetea. Limpiar datos de prueba.

## Gotchas heredados a respetar
- LAN: nada de `crypto.randomUUID` en cliente (usar `uid()` de shared).
- Verificar con `next start` (dev server muere por OOM en esta máquina).
- Rutas nuevas de (main) → añadir a proxy.ts.
- Actions devuelven `{ error?: string }`; unique violation = code 23505.
- `npm run lint` roto → `npx tsc --noEmit`.
- ai@7: los tools usan `inputSchema` (no `parameters`).
