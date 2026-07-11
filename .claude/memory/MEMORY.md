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
- PRP-010 APROBADO, EN ESPERA (2026-07-10): Outlook free/busy vía Microsoft Graph — enlazar cuenta
  Microsoft desde Ajustes con DEVICE CODE FLOW (el flujo clásico con redirect NO funciona desde la LAN:
  Azure solo permite http en localhost), elegir calendario a consultar (calendarView del calendario
  elegido, NO getSchedule que no soporta cuentas personales), y bloquear huecos ocupados en /book +
  revalidación + reprogramar. Solo LECTURA (escribir en Google Calendar sigue siendo otro PRP pendiente).
  Decisión Tony: eventos "provisionales" (tentative) NO bloquean, solo busy+oof. Fail-open si Graph falla.
  PRP en `.claude/PRPs/prp-outlook-freebusy.md`. ⚠️ NO EJECUTAR hasta aviso de Tony (otro agente está
  programando otra feature en paralelo en este repo). Requiere de Tony: app registration en Azure
  (public client, sin secret) → MICROSOFT_CLIENT_ID en .env.local.
  ⚠️ COORDINACIÓN: su migración se renumeró a `0007_outlook_integration.sql` porque el `0006` lo tomó
  (y ya aplicó) el Form Builder (PRP-011). El nº de PRP 010 se conserva para Outlook; el Form Builder es PRP-011.
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
  configurar cron para /api/cron/process-emails, deploy en VPS+dominio, OPENROUTER_API_KEY para la IA de funnels.
- GOTCHA máquina compartida (detalle en prp-funnels.md): validar con `next start` (dev server muere por OOM),
  browser Playwright en ráfagas cortas, y confirmar que el puerto sirve TU app (Docker de otros convive en 3000).
