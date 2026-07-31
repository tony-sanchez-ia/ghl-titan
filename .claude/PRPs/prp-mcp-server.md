# PRP-016: Servidor MCP de GHL Titan (conexión para el Business OS)

> Estado: **PREPARADO, NO EJECUTAR TODAVÍA** (2026-07-31). Tony lo activará cuando quiera,
> idealmente DESPUÉS del deploy en VPS (URL estable + HTTPS). Decisiones ya tomadas con él
> en conversación — no re-preguntar.

## Objetivo
Que agentes externos de Tony (su "Business OS": un Claude Code local en su máquina) se
conecten a GHL Titan como se conectan hoy a n8n: un **servidor MCP propio** (`ghl-titan-mcp`)
expuesto por la app, con herramientas tipadas para consultar prospectos y hacer seguimiento.

## Decisiones de producto (cerradas con Tony, 2026-07-31)
- **MCP, no REST**: su Business OS es Claude Code → MCP es el enchufe nativo, sin manual que mantener.
- **SIN pipeline de etapas**: el seguimiento se hace con ETIQUETAS (p. ej. contactado/seguimiento).
  El control de oportunidades vive en su Business OS, no en GHL Titan.
- **Lectura completa + escrituras seguras**: etiquetar/des-etiquetar y añadir notas. NUNCA exponer:
  enviar emails, borrar nada, tocar campañas/ajustes.
- **NUNCA acceso directo a BD desde fuera**: las escrituras deben pasar por los servicios de la app
  para que disparen las automatizaciones (trigger `tag_added`). SQL directo se las saltaría.

## Arquitectura propuesta
- **Ruta** `src/app/api/mcp/[transport]/route.ts` con el paquete `mcp-handler` (Vercel), transporte
  **Streamable HTTP stateless** (sin Redis, sin SSE legacy). Verificar compatibilidad con Next 16
  en el momento de implementar.
- **Auth**: token estático largo (`MCP_API_TOKEN`, generar con `openssl rand -hex 32`) por header
  `Authorization: Bearer`. Validar en la ruta ANTES de delegar al handler (los `/api/*` NO pasan por
  el proxy — mismo patrón que `/api/assistant/chat`). Comparación en tiempo constante si es fácil;
  jamás loguear el token.
- **Capa compartida**: extraer la lógica de los `execute` de
  `src/features/assistant/services/tools.ts` a un servicio común (p. ej.
  `src/features/assistant/services/crm-data.ts`) que usen TANTO el Asistente IA del panel como el
  MCP. Sin cambiar el comportamiento del asistente (tsc + smoke test tras el refactor).

## Herramientas MCP (v1)
Lectura (reutilizan lo del asistente):
1. `buscar_contactos` (texto y/o etiqueta) — hasta 20 + total.
2. `ver_contacto` (email o nombre) — ficha 360: datos, etiquetas, últimas interacciones, citas.
3. `resumen_audiencia` — totales, bajas, etiquetas con conteos.
4. `listar_campanas` / `ver_campana` — solo lectura, para contexto.

Escritura segura (NUEVAS, vía servicios de la app):
5. `etiquetar_contacto` (id/email + etiqueta) — DEBE disparar `fireTrigger('tag_added')` usando el
   mismo camino que la UI de contactos (mapear el servicio real en la fase de mapeo; NO update SQL
   a pelo). Registrar activity.
6. `quitar_etiqueta` (id/email + etiqueta).
7. `añadir_nota` (id/email + texto) — como `contact_activities` (existe el tipo de nota que usa el
   paso add_note de automatizaciones; confirmar el `type` exacto en el mapeo).

## Conexión desde el Business OS (documentar al final en DEPLOY.md y entregarle el snippet)
```
claude mcp add --transport http ghl-titan https://SU-DOMINIO/api/mcp \
  --header "Authorization: Bearer <MCP_API_TOKEN>"
```
(En LAN, mientras no haya deploy: `http://192.168.1.20:<puerto>/api/mcp` con `next start`.)

## Fases
1. MAPEO: confirmar cómo edita etiquetas la UI de contactos y dónde vive `fireTrigger('tag_added')`
   (PRP-006/engine.ts); confirmar type de activity para notas; verificar versión de `mcp-handler`.
2. Refactor a capa compartida `crm-data.ts` → verificar: tsc + el asistente del panel sigue igual.
3. Ruta MCP + auth por token → verificar: curl sin token 401, handshake initialize con token OK.
4. Tools de lectura → verificar: `claude mcp add` local + consulta real de un contacto.
5. Tools de escritura → verificar E2E: etiquetar desde MCP dispara una automatización activa con
   trigger etiqueta y deja activity en el timeline. Limpiar datos de prueba.
6. Docs: `MCP_API_TOKEN` en DEPLOY.md y .env.local.example + snippet de conexión para Tony.

## Gotchas heredados a respetar
- Fechas de pg (Date) → SIEMPRE `iso()` en la frontera de tools (gotcha PRP-015: si no,
  AI_TypeValidationError/JSON inválido).
- `add_tag` desde un workflow NO dispara triggers (anti-bucle, PRP-006) — pero etiquetar desde MCP
  SÍ debe dispararlos (es equivalente a hacerlo a mano en la UI).
- Los `/api/*` no pasan por el proxy → auth propia en la ruta.
- Build local: gotcha earlyoom (ver MEMORY.md) — tsc aparte + valles de memoria.
- Verificar con `next start`, no dev server.

## Coste estimado
Una sesión corta (menos que PRP-015: la capa de datos ya existe). Sin costes mensuales.
Una env nueva (`MCP_API_TOKEN`) en EasyPanel al desplegar.
