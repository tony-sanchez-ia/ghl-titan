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
- PRP-016 COMPLETADO (2026-08-13): SERVIDOR MCP en /api/mcp (mcp-handler 2.1 + @modelcontextprotocol/server 2,
  ruta única SIN segmento [transport], streamable HTTP stateless sin Redis). 8 tools: 5 lectura + etiquetar
  (dispara fireTrigger('tag_added') + processDueEmails, activity en timeline), quitar_etiqueta, anadir_nota
  (activity 'note'). Capa compartida crm-data.ts — los tools del asistente del panel ahora DELEGAN en ella.
  Auth: Bearer MCP_API_TOKEN (timingSafeEqual; sin env → 401 todo). Verificado E2E: 17/17 checks JSON-RPC
  (401, initialize, tools/list, lecturas y escrituras reales con huella en BD) + cliente Claude Code REAL
  conectado (claude mcp add --transport http + list → ✔ Connected). Conexión del Business OS documentada en
  DEPLOY.md. PENDIENTE Tony: MCP_API_TOKEN en EasyPanel + rebuild. Token local ya en .env.local.
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
- DEPLOY HECHO (2026-08-12): GHL Titan EN PRODUCCIÓN en https://ghl.titanicfactory.com (VPS EasyPanel de
  Tony, misma BD Neon que local). Verificado E2E real: login, dashboard, /book con reserva real → dedup
  contacto + activities + EMAIL DE CONFIRMACIÓN ENVIADO desde email.titanicfactory.com (dominio VERIFICADO
  en Resend; EMAIL_FROM=Titanic Factory <no-reply@email.titanicfactory.com> en local y prod). Cron endpoint
  OK (200 con token/401 sin). Valores EasyPanel + URL del cron en .env.easypanel.local (gitignored).
  AUTH_SECRET de prod = el local (OBLIGATORIO: tokens Outlook cifrados con clave derivada de él).
  GOTCHA cron-en-contenedor: Docker inyecta HOSTNAME=<container-id> PISANDO el ENV del Dockerfile;
  Next standalone se bindea a ese hostname → localhost NO escucha dentro del contenedor. El wget del
  entrypoint debe usar ${HOSTNAME} (fix 2026-08-13). El endpoint /api/cron siempre se puede disparar
  a mano desde fuera con el CRON_SECRET para distinguir "endpoint roto" de "bucle no dispara".
  CRON AUTOMÁTICO VERIFICADO en prod (2026-08-13): email de prueba salió SOLO tras el fix. OJO al
  verificar el cron: las reservas/forms procesan la cola INLINE — pueden "robar" la prueba (pasó).
  PENDIENTE: programar el cron (opciones en .env.easypanel.local), dominios iatitans.com/trabajadoria.com
  (multidominio funnels/sitios, esperan un funnel/sitio asignado), y ANTES DE CANCELAR GHL: migrar el curso
  completo (GHL tiene 6 módulos, Titan solo 2 módulos/2 lecciones) + redirigir enlaces públicos viejos de
  agendación de GHL. Repo GitHub PÚBLICO (avisado a Tony por si quiere hacerlo privado).
- PRP-017 COMPLETADO (2026-08-12): GOOGLE CALENDAR + MEET por cita — code flow con redirect (device flow
  NO admite Calendar), rutas /api/integrations/google/start|callback (state en cookie httpOnly, sesión
  obligatoria), google-auth.ts + google-events.ts (fail-open 5s), card en Ajustes (comparte la card de
  Outlook vía children). Evento para TODA reserva (decisión Tony), prospecto invitado con sendUpdates:none,
  Meet único si location_type='google_meet' → se guarda en bookings.location_value (email/panel sin cambios)
  + bookings.google_event_id (migración 0012, aplicada). Cancelar borra evento, reprogramar lo mueve.
  GOTCHAS NUEVOS (detalle en el PRP): redirects de rutas API SIEMPRE sobre NEXT_PUBLIC_SITE_URL (request.url
  normaliza el host y pierde cookies); route.ts no admite exports propios (constantes al servicio).
  ACTIVADO Y VERIFICADO E2E REAL (2026-08-13): Tony hizo el alta en Google Cloud, claves en EasyPanel,
  conectó su cuenta (titanicfactorymedia@gmail.com) y la prueba real funcionó entera: reserva → evento
  en su Google Calendar + Meet único (meet.google.com/yej-rbnb-wdx) + enlace en email → cancelar desde
  el panel borró el evento. Datos de prueba limpiados. Las claves Google SOLO están en EasyPanel
  (no en .env.local — en local la card sale "sin configurar", la conexión vive en la BD compartida).
- GOTCHA checks: `npm run typecheck` NO existe y `npm run lint` está roto (Next 16 quitó next lint) →
  usar `npx tsc --noEmit`. Si el Playwright MCP está "already in use" (otro agente): script Node con el
  playwright del caché npx (~/.npm/_npx/*/node_modules) + executablePath a un chromium_headless_shell
  de ~/.cache/ms-playwright (detalle en prp-outlook-freebusy.md).
- GOTCHA NEON COSTE (2026-10-08): Tony veía ~$5/mes de compute en Neon SIN usar la app. Causa: el cron interno
  (docker-entrypoint.sh, cada 300s) consultaba la BD cada 5 min = justo el umbral de scale-to-zero de Neon → la
  BD NUNCA se dormía. Fix: cron-gate.ts (features/automations/services) — el cron salta la BD salvo que haya
  habido queries en el proceso desde la última revisión (db.ts registra lastQueryAt), venza trabajo ya conocido
  (min de scheduled_emails/enrollments/campañas) o pasen 6h (red de seguridad para cambios hechos desde LOCAL,
  que comparte la BD). Verificado local: 1ª llamada procesa, siguientes {skipped:true}, visita a /book reactiva.
  REGLA: nunca meter un poller que toque Neon con intervalo ≤5 min. Tablas vacías user/session/jwks/organization...
  + conexión 'neon_auth' consultando project_config = Neon Auth activado en el proyecto (no lo usamos); si el
  compute sigue sin dormirse tras el deploy, sospechar de eso.
  CONFIRMADO EN PROD (2026-10-08): tras rebuild en EasyPanel, Tony ve el compute de Neon a 0 en reposo.
  Neon Auth NO impedía el scale-to-zero (no hace falta desactivarlo).
- NUEVA INSTANCIA robotrock.live (2026-10-17): BD Neon nueva (ep-soft-fire-bale0zrf, eu-central-1) inicializada con
  las 12 migraciones de db/migrations (aplicadas en orden, una transacción cada una, 32 tablas public) + admin
  info@robotrock.live (login verificado con bcrypt). BD vacía de datos (0 contactos/calendarios/forms): calendario,
  curso, etc. se crean desde el panel. Neon trae de serie el esquema neon_auth (no lo usamos, no molesta).
  CÓMO inicializar otra instancia: scripts/run-sql.js y create-admin.js leen SOLO .env.local → para otra BD se usó
  un script puntual con la URL por env. Quitar `channel_binding=require` de la URL (copiar de Neon la trae).
  Pendiente Tony: env de EasyPanel de esa instancia (AUTH_SECRET/CRON_SECRET/MCP_API_TOKEN PROPIOS, nuevos).
- robotrock.live DESPLEGADA (2026-10-17) en EasyPanel, dominio temporal https://robotrockalive-apps-ghl-titan.1cdrz2.easypanel.host
  (otro servidor). Valores en .env.robot (gitignored). `/` daba 404 porque NEXT_PUBLIC_SITE_URL no llegó al BUILD
  (proxy reescribe a /sites/<host>; delator: header x-middleware-rewrite) → poner en Build Arguments + Deploy.
  MCP verificado (401 sin token, initialize + 8 tools + resumen_audiencia OK) y registrado en Claude Code como
  `robotrock-ghl` (scope local, ~/.claude.json, NO en el repo).
- PRP-018 COMPLETADO (2026-11-06): INSTANCIA CONFIGURABLE — en Ajustes, tarjeta "Marca" (logo subido ≤500KB
  png/jpg/webp/svg guardado en BD bytea, nombre de empresa, color de acento) y tarjeta "Módulos" (Cursos, Embudos,
  Sitios web, Formularios ON/OFF). Tabla de UNA fila instance_settings (migración 0013, defaults todo ON/sin marca;
  APLICADA en la BD compartida local+ghl.titanicfactory.com). Apagar = solo oculta del panel (sidebar + layouts de
  sección con requireModule → /dashboard); lo público (/learn, /p, /w, /form, titan-forms.js) sigue vivo. Color: <style>
  con --primary/--primary-fg (negro/blanco por luminancia)/--primary-soft solo en layouts (main) y (auth) → público y
  emails intactos. Logo servido por /api/brand/logo (nosniff + CSP sandbox; SVG con script/on*= rechazado). Título
  pestaña = nombre (template "%s — nombre"). getInstanceSettings() con cache() y fallback a defaults si la tabla no
  existe (deploy antes de migrar no rompe la lectura, pero GUARDAR en Ajustes sí falla). Feature en
  src/features/instance/ + src/actions/instance.ts. E2E real OK (next start, script Playwright).
  PENDIENTE: aplicar 0013 en la BD de robotrock.live (Neon propia) + rebuild de ambas instancias en EasyPanel.
- GOTCHA shell: `pkill -f "<patrón>"` dentro de un comando Bash mata también a ESE shell (su línea contiene el
  patrón) → exit 144 y lo que venía detrás no se ejecuta. Parar servers por PID o en un comando aparte.
