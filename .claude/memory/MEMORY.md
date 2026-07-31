# Memoria del Proyecto — Indice

> Archivos organizados por carpeta (tipo). Max 200 lineas.
> Gestionado por skill memory-manager. Auto-memory de Claude Code DESACTIVADO.

## user/ — Sobre el usuario/equipo
- Tony (Titanic Factory). Email: titanicfactorymedia@gmail.com. GitHub: tony-sanchez-ia.
- NO es técnico: hablar en lenguaje de negocio, no jerga. Decisiones técnicas las toma el agente (Golden Path).
- Desarrolla/prueba desde OTRA máquina de la LAN → accede por `http://192.168.1.20:3000` (192.168.1.20 = máquina servidor).
- Trabaja mucho en modo autónomo: cuando dice "dale con todo lo que puedas" quiere máximo avance sin pedir confirmación constante; verificar en browser y limpiar datos de prueba.

## project/ — Proyectos y decisiones activas
- `ghl-titan-vision.md` — Visión + TODO el estado de GHL Titan: reemplazar GoHighLevel ($100/mes) con plataforma
  propia. Estado a 2026-06-13: CRM (189 contactos + vista 360), Agenda (reservas públicas con calendario mensual +
  gestión cancelar/reprogramar), Cursos (Kajabi-style + certificado), Automatizaciones (form→drip), Emails (Resend),
  Ajustes + modo noche. 5 PRPs completados. Repo en GitHub. Deploy preparado (Docker/EasyPanel), pendiente VPS+dominio.
- `neon-migration.md` — 2026-07-01: MIGRADO de Supabase a Neon (Supabase pausó el proyecto free y Tony quiso irse).
  BD en Neon (pg directo), auth propia (bcrypt + JWT cookie, AUTH_SECRET), sin RLS. Todo verificado E2E. Ver detalle.
- PRP-006 COMPLETADO (2026-07-01): automatizaciones VISUALES tipo GHL — builder vertical, triggers
  form/reserva/etiqueta, pasos tipados, ramas por click con tracking /r/[token]. Detalle en neon-migration.md y el PRP.
- PRP-008 COMPLETADO (2026-07-06): EDITOR DE EMAILS V2 — secciones con columnas tipo GHL (8 layouts,
  fondo/padding por sección, apilado móvil vía inline-block + media query), 5 bloques nuevos (redes
  sociales con iconos propios en public/email/social, vídeo con miniatura YouTube auto, formulario,
  código HTML saneado, texto con negrita/cursiva/enlaces trackeados vía contentEditable propio),
  estilos globales (fondo + color de botones) y "ver este email en el navegador" (/e/[click_token]).
  Diseño versionado en el MISMO jsonb (version:2, migración perezosa V1→V2 sin SQL; sent nunca se
  reescribe). Saneadores sin dependencias en services/sanitize.ts (whitelist inline + limpieza raw).
  GOTCHAS nuevos en el PRP: toolbars flotantes tapan contenedores vacíos (usar barras estáticas);
  contentEditable pierde la selección si el toolbar no hace preventDefault en mousedown.
- PRP-009 COMPLETADO (2026-07-06): FUNNELS tipo GHL — sección /funnels (Embudos): embudos con pasos,
  editor visual de PÁGINAS web (mismo lenguaje secciones/columnas que el editor de emails; render
  compartido editor↔público en page-render.tsx), páginas públicas /p/[funnel]/[paso] SSR,
  MULTIDOMINIO vía Host-rewrite en proxy.ts → /sites/[host] (runbook DNS+EasyPanel en DEPLOY.md),
  tracking (cookie tv_id, page_view dedupe/día, cta_click, form_submit vía /api/track), formulario
  embebido (contacto+automatizaciones+salto de paso), test A/B (50/50 sticky por hash, declarar
  ganadora conserva historial — FK set null, migración 0005), estadísticas con % paso a paso, y
  generación por IA (ai@7 + OpenRouter, generateObject+Zod, degrada sin key). Migraciones 0004+0005.
  sanitize.ts y RichTextInput MOVIDOS a shared/ (shims en marketing). Verificado E2E en browser.
  PENDIENTE Tony: OPENROUTER_API_KEY (openrouter.ai/keys) para activar la IA.
- PRP-010 IMPLEMENTADO (2026-07-11): Outlook free/busy vía Microsoft Graph — card Integraciones en
  Ajustes con DEVICE CODE FLOW (el flujo clásico con redirect NO funciona desde la LAN: Azure solo
  permite http en localhost; código corto + microsoft.com/devicelogin + polling), selector del
  calendario a consultar (calendarView del calendario elegido, NO getSchedule que no soporta cuentas
  personales), y busy de Outlook fusionado ANTES de generateSlots en los 3 puntos: page /book,
  createPublicBooking y getRescheduleSlots (NO en getPublicCalendarBySlug: la llama también
  generateMetadata y duplicaría la llamada a Graph). Solo LECTURA (escribir en Google Calendar sigue
  siendo otro PRP pendiente). Decisión Tony: tentative NO bloquea, solo busy+oof. Fail-open si Graph
  falla (timeout 5s). Tokens: refresh cifrado AES-256-GCM (clave derivada de AUTH_SECRET) en tabla
  integration_connections (migración 0007, aplicada); refresh ROTA en cada uso. Feature en
  src/features/integrations/ + src/actions/integrations.ts. Verificado E2E con next start: card OK,
  error amable sin client ID, /book genera huecos sin conexión. PENDIENTE Tony: app registration en
  Azure (public client, "Allow public client flows"=Yes, sin secret) → MICROSOFT_CLIENT_ID en
  .env.local → enlace real + prueba con evento ocupado real. PRP: prp-outlook-freebusy.md.
- PRP-011 COMPLETADO (2026-07-10): EDITOR DE FORMULARIOS tipo GHL — apartado Web (sidebar agrupa
  Embudos + Formularios). Sección /forms: editor visual con paleta de campos tipados (texto, email,
  teléfono, número, fecha, desplegable, opción única, selección múltiple, consentimiento, título/
  párrafo, oculto), ancho completo/media columna, panel Estilos (temas + colores/bordes en vivo),
  "Al enviar" (mensaje con formato o redirección + etiquetas + vincular automatización vía el trigger
  form_submitted existente), Integrar (enlace + iframe inline auto-alto + popup con disparadores),
  Envíos y Análisis (vistas únicas/día, envíos, % conversión). Se EXTENDIÓ la tabla `forms` (schema/
  styles/settings jsonb + status; migración 0006) en vez de crear otra → automatizaciones, funnels y
  emails siguen apuntando al mismo form (backfill del form demo). Motor submitForm reutiliza el patrón de
  submitPublicForm (dedup por email + activity + fireTrigger). Tablas nuevas: form_submissions, form_events.
  Loader público en `public/titan-forms.js` (NO bajo /forms, que es ruta protegida). Feature en
  src/features/forms/ + src/actions/forms.ts. Verificado E2E real (crear→estilar→publicar→enviar desde
  iframe CROSS-ORIGIN con auto-alto→contacto+etiqueta+timeline+envío+análisis 1/1/100%; datos de prueba
  limpiados). Retirado el CRUD viejo de forms de /automations (redirige a /forms). GOTCHAS en el PRP:
  /forms protegido en proxy → el loader va a la raíz pública; visitor id en localStorage (no cookie, para
  iframes de terceros); email siempre requerido (clave de dedup). Sin pendientes de Tony.
- PRPs 012+013+014 COMPLETADOS (2026-07-11, sesión "3 frentes", todos E2E verificados con next start):
  · PRP-012 CURSOS: el 404 de /learn era curso en Borrador (no bug) → banner de aviso + Publicar primario;
    card Alumnos (añadir por email → contacto CRM + enlace de acceso personal /learn/[slug]/access/[token],
    progreso, quitar); courses.access_mode 'open'|'invite' (invite bloquea inscripción libre); migración 0008;
    FIX clipboard: navigator.clipboard roto en LAN http → shared/lib/clipboard.ts (usar SIEMPRE copyText).
  · PRP-013 EMAILS DISEÑADOS EN AUTOMATIZACIONES: paso send_email con 2 modos (Sencillo texto | Diseñado
    con el editor visual de Marketing) — diseñador en /automations/[id]/email/[nodeId] (autosave a
    node.config.design V2, carga de plantillas); snapshot del diseño en scheduled_emails.design (migración
    0009), render al enviar con merge tags + pie de baja; /r valida contra extractDesignUrls; los dados de
    baja YA NO reciben emails de secuencia (RGPD). GOTCHA: el form demo tiene consentimiento required.
  · PRP-014 SITIOS WEB tipo GHL: sección Web→Sitios web — sitios multipágina con el editor de páginas de
    funnels (PageBlockSettings ahora recibe onRewrite callback; esquema de diseño extraído a
    page-design-schema.ts compartido), IA generateWebsitePages, favicon + scripts head/body (se inyectan
    en el HTML SSR), /w/[slug]/[pagina] en dominio principal y MULTIDOMINIO compartido con funnels
    (/sites/[host] resuelve funnel→website; unicidad cruzada en actions). Tablas websites/website_pages/
    website_domains (migración 0010). Forms embebidos funcionan sin métricas de funnel
    (PageTrackContext.stepId/variantId nullable). DEPLOY.md ampliado.
- PRP-015 COMPLETADO (2026-07-30): ASISTENTE IA DE COPYWRITING — sección /assistant (sidebar "Asistente IA",
  icono Sparkles): chat streaming (Vercel AI SDK ai@7 `streamText` + tools + `stopWhen: stepCountIs(8)`,
  respuesta `toTextStreamResponse()`, cliente SIN @ai-sdk/react: fetch + getReader). Modelo
  anthropic/claude-sonnet-4.6 vía OpenRouter (env opcional OPENROUTER_ASSISTANT_MODEL; assistantModel() en
  lib/ai/openrouter.ts). 7 tools: resumen_audiencia, buscar_contactos, ver_contacto, listar_campanas,
  ver_campana, crear_borrador_newsletter (diseño V2 con newSection + header/footer, SIEMPRE status draft —
  decisión Tony: el agente NUNCA envía), guardar_memoria. Memoria de marca en tabla assistant_memories
  (migración 0011), inyectada entera al system prompt; auto-aprende + panel UI ver/editar/borrar/resetear
  (actions/assistant.ts). API /api/assistant/chat valida sesión con getSession() (los /api/* NO pasan por proxy).
  Verificado E2E real: pregunta con datos (189), memoria guardada por el agente + dedupe entre sesiones
  ("ya lo tenía guardado"), borrador creado y abierto en el editor visual. Datos de prueba limpiados
  (queda 1 memoria real de marca). GOTCHAS: (1) pg devuelve timestamptz como Date y el AI SDK valida el
  output de tools como JSON puro → convertir SIEMPRE fechas con helper iso() en la frontera del tool, si no
  AI_TypeValidationError rompe el stream en silencio; (2) el modelo mete markdown en el chat → prohibirlo en
  el system prompt (el chat renderiza texto plano + linkifica rutas); (3) /marketing abre en pestaña
  Estadísticas — los borradores están en ?tab=campaigns. PRP: prp-copywriting-agent.md.
- PRP-007 COMPLETADO (2026-07-05): EMAIL MARKETING tipo GHL — sección /marketing (Estadísticas/Campañas/
  Plantillas), diseñador visual por bloques (una columna, sin librerías), campañas a todos/por etiquetas
  (ahora o programadas), cola idempotente por lotes (claim atómico, 25/cron + 10 inline), tracking de
  clicks vía /r/[token] (tokens de campaign_recipients), baja RGPD /unsubscribe/[token] (confirmación
  por botón anti-prefetch) y embudo de estadísticas. Tablas: email_campaigns, campaign_recipients,
  email_templates + unsubscribed_at/unsubscribe_token en contacts (migración 0003). Verificado E2E real.
  GOTCHAS nuevos en el PRP: pgcrypto para gen_random_bytes; rutas nuevas de (main) hay que añadirlas
  al proxy.ts; bg-primary/40 no funciona (colores var() sin alpha-value) → opacity inline.

## feedback/ — Correcciones y preferencias
- Diseño: rechazó el violeta eléctrico "techno" (Liquid Glass). Quiere interfaz CLÁSICA, clara, blancos, azul de acento,
  con botón de modo noche. (Implementado: tokens en globals.css + ui.ts, next-themes).
- La splash/landing intermedia le parece inútil: la raíz va directa al login/panel.
- Valora honestidad sobre lo que falta y la verificación real en navegador.

## reference/ — Donde encontrar cosas
- PRPs completados en `.claude/PRPs/`: prp-contacts, prp-scheduling, prp-cursos, prp-email-automations (+ gestión citas inline).
- Guía de deploy: `DEPLOY.md` (adaptada a Supabase, NO Prisma). GOTCHA: NEXT_PUBLIC_* van como Build Args.
- Scripts locales (no en runtime): `scripts/run-sql.js` (migraciones), `create-admin.js`, `import-contacts.js`.
- Secretos en `.passwords` y `.env.local` (gitignored). Admin: titanicfactorymedia@gmail.com / TitanAdmin2026!.
- Supabase project ref: jrojsliuubvsjxkkzrxq. Migraciones versionadas en `supabase/migrations/` (0001-0005).
- Gotchas clave (detalle en ghl-titan-vision.md): acceso LAN → allowedDevOrigins + -H 0.0.0.0; limpiar .next tras mover
  archivos raíz (OOM); next-themes gatear todo tras `mounted`; Supabase relaciones embebidas → cast `as unknown as`.
- Pendiente del usuario: verificar dominio Resend (emails a terceros), conectar Google Calendar (Meet por cita),
  configurar cron para /api/cron/process-emails, deploy en VPS+dominio.
- OPENROUTER_API_KEY CONFIGURADA (2026-07-30): Tony la pegó como `OPENROUTER_APIKEY` (sin el guión bajo) →
  corregido a `OPENROUTER_API_KEY` en .env.local. Clave válida, con crédito (no free tier), y verificada
  contra la API: chat + generación ESTRUCTURADA (json_schema) OK con el modelo por defecto
  anthropic/claude-sonnet-4.5 vía Bedrock. IA de funnels y sitios web ACTIVA. Añadidas
  OPENROUTER_API_KEY + MICROSOFT_CLIENT_ID a la lista de env runtime de DEPLOY.md (faltaban las dos).
  GOTCHA: al pegar claves, verificar SIEMPRE el nombre exacto que lee el código (grep en src/).
- Outlook CONECTADO (2026-07-12): Tony creó la app Azure (client ID en .env.local como MICROSOFT_CLIENT_ID),
  enlazó su cuenta por device code y funciona. Añadida vista semanal LUN-SÁB del calendario de Outlook en
  /calendars (entre Calendarios y Próximas citas): outlook-events.ts (calendarView con subject) +
  OutlookWeekView.tsx (RSC pura, nav ?week=lunes, rejilla horaria 8-21 autoexpandible, colores por showAs,
  fila de día completo, Europe/Madrid). Verificado en browser con sus eventos reales.
- GOTCHA máquina compartida (detalle en prp-funnels.md): validar con `next start` (dev server muere por OOM),
  browser Playwright en ráfagas cortas, y confirmar que el puerto sirve TU app (Docker de otros convive en 3000).
- GOTCHA build local (2026-07-30): `earlyoom -r 3600` corre en la máquina y MATA `next build` (SIGTERM, exit 143)
  en cuanto la RAM disponible baja del umbral — la swap vive al 99% (sesiones de roberto/yadira + n8n de tony),
  así que salta con cualquier pico. Workaround: (1) temporal en next.config.ts `typescript:{ignoreBuildErrors:true}`
  (tras `npx tsc --noEmit` aparte) + `experimental.cpus:1` — REVERTIR tras el build; (2) bucle que espera
  avail ≥1600MB (`free -m`) antes de intentar. Los exit 144 sueltos del shell son el mismo fenómeno.
- GOTCHA checks: `npm run typecheck` NO existe y `npm run lint` está roto (Next 16 quitó next lint) →
  usar `npx tsc --noEmit`. Si el Playwright MCP está "already in use" (otro agente): script Node con el
  playwright del caché npx (~/.npm/_npx/*/node_modules) + executablePath a un chromium_headless_shell
  de ~/.cache/ms-playwright (detalle en prp-outlook-freebusy.md).
