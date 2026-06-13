# GHL Titan — Visión del Proyecto

> Capturado: 2026-06-12, conversación inicial con Tony.

## Objetivo de negocio
Reemplazar la suscripción de GoHighLevel (~$100/mes, ~$1200/año) con una
plataforma propia: **GHL Titan**. Plataforma instanciable N veces (por cliente
o por situación).

## Lo que Tony usa HOY de GoHighLevel (3 instancias)

1. **Instancia Titanic Factory**: solo contactos que se registran vía un
   sistema de agendación tipo Calendly. Nada más (ni funnels ni páginas).
2. **Instancia cursos**: módulo de cursos (memberships). Tiene UN curso creado
   que quiere conservar. Quiere poder seguir creando cursos (estilo Kajabi).
   Hay una landing vieja que ya no se usa — descartable.
3. **Instancia email automation**: un dominio conectado + automatización:
   formulario → se dispara secuencia de emails al usuario.

## Lo que NO le interesa de GHL
Funnels (los crearía con Claude/la fábrica), páginas, todo lo demás.

## Requisitos clave expresados
- Plataforma instanciable por cliente/situación.
- Migrar contactos del CRM + calendly interno (primera instancia, urgente).
- Módulo de cursos tipo Calendly/Kajabi (sencillo).
- Automatizaciones de email (form → secuencia).
- Control de la parte de DNS/dominios (lo considera lo potente de GHL).
- Le gustaría que quede más bonito que el interfaz actual de GHL.
- Ofreció pantallazos del interfaz actual para referencia.

## Decisiones de producto (2026-06-12, entrevista new-app)
- Modelo: plantilla instanciable, 1 instancia = 1 Supabase + 1 deploy Vercel + dominio
- Disponibilidad agenda: horario fijo semanal (sin sync Outlook en V1)
- Videollamada: Google Meet ÚNICO por cita (OAuth Google del admin) — eligió la opción avanzada
- Alcance V1: CRM + Agenda + emails de cita. Fase 2: automatizaciones + cursos
- Admin único por instancia. Pipeline de ventas: descartado (sin uso en GHL)
- KPI: cancelar suscripción GHL (190 contactos migrados + 1 reserva real end-to-end + deploy en dominio propio)

## Material de referencia
- `referencias/` — 17 pantallazos del GHL actual (contactos, calendario completo, cursos, automatización)
- `referencias/Export_Contacts_undefined_Jun_2026_11_12_PM.csv` — 190 contactos
  (schema: Contact Id, First Name, Last Name, Phone, Email, Business Name, Created, Last Activity, Tags)
- Detalle calendario GHL: 45min, aviso mín 12h, ventana 14 días, form nombre/email/teléfono,
  emails confirmación+recordatorio+seguimiento, URL pública /widget/bookings/discovery_call_tony
- Curso "IA TITANS EXPRESS": 6 módulos, lecciones video/texto/quiz (single choice), certificado
- Su agenda real vive en Microsoft/Outlook (Graph API en GHL) — candidata a sync fase 2

## Decisiones técnicas de implementación
- Design system: **CLÁSICO claro/oscuro** (2026-06-13, el usuario rechazó el violeta Liquid Glass por "demasiado techno").
  Tokens semánticos en variables CSS (`globals.css` :root + .dark), presets en `src/shared/lib/ui.ts` (ui.card/button/buttonPrimary/input),
  modo noche con next-themes (`theme-provider.tsx` + `theme-toggle.tsx`). Acento azul (#2563eb), fondo claro slate, sidebar blanca.
  Iconos: lucide-react. Liquid Glass (glass.ts, glass-background.tsx) ELIMINADO.
- GOTCHA next-themes: gatear TODO lo que dependa del tema (incl. aria-label) tras `mounted` o da hydration mismatch.
- Supabase project ref: jrojsliuubvsjxkkzrxq (eu-west-1). Credenciales en `.env.local` (gitignored; origen: `.passwords`, también gitignored junto a `referencias/` por datos personales)
- Supabase MCP sin access token personal → migraciones/SQL vía `node scripts/run-sql.js <archivo.sql>` (pg directo por pooler, DATABASE_URL en .env.local)
- Migraciones versionadas en `supabase/migrations/` (0001_profiles.sql aplicada)
- Next.js 16: `src/proxy.ts` (NO en root — con carpeta src/ debe ir dentro de src/)
- Tailwind v3.4: globals.css usa directivas @tailwind (la template traía sintaxis v4 por error — corregido)
- Auth: email/password sin botón Google (OAuth Google se reserva para integración Meet por cita)
- Auto-blindaje 2026-06-12: next dev crasheaba con OOM cada ~5 min. CAUSA REAL: caché .next
  obsoleta tras mover proxy.ts de root a src/ (error "Could not parse module '[project]/proxy.ts'"
  en bucle interno → fuga ~15MB/s). FIX: `rm -rf .next` tras mover/renombrar archivos raíz.
  Nota: en Next 16 `next dev` usa Turbopack SIEMPRE (el flag --turbopack es redundante);
  el script dev lleva además NODE_OPTIONS=--max-old-space-size=4096 como margen (sintaxis unix)

## Setup de red / acceso
- Tony desarrolla/prueba desde OTRA máquina de la LAN, accediendo a `http://192.168.1.20:3000`
  (192.168.1.20 = máquina servidor). Configurado `allowedDevOrigins` + `-H 0.0.0.0`.
- Admin creado: titanicfactorymedia@gmail.com / TitanAdmin2026! (confirmado vía service_role, cambiar luego)
- Resend configurado (.env.local): RESEND_API_KEY + EMAIL_FROM=onboarding@resend.dev.
  LÍMITE: hasta verificar dominio propio, solo envía desde resend.dev y solo al email de registro.
  Verificar dominio (DNS) cuando lleguemos al módulo de Agenda.
- Splash inicial eliminada: `/` redirige directo a `/dashboard` (proxy manda a /login si no hay sesión).

## Estado (2026-06-12)
- ✅ Base visual Liquid Glass: landing, sidebar, dashboard placeholder, verificado en browser
- ✅ Auth completo (add-login): login/signup/reset, profiles+RLS+trigger, rutas protegidas vía proxy. E2E verificado: /dashboard redirige a /login, error de credenciales llega desde Supabase
- ⏳ Tony debe crear su cuenta admin en /signup (su email/password)
- ✅ Re-theme a clásico claro/oscuro + módulo Contactos COMPLETO (2026-06-13):
  CRUD manual + importador CSV (189 contactos reales importados, idempotente por ghl_contact_id),
  lista con búsqueda + filtro por tag (GIN), ficha con timeline de actividad, chips de tags de color.
  Tablas contacts + contact_activities con RLS. Build de producción OK. Verificado en browser por la IP LAN.
  Scripts: run-sql.js, create-admin.js, import-contacts.js.
- Resend configurado (RESEND_API_KEY + EMAIL_FROM en .env.local). Falta verificar dominio para enviar a terceros.
- ✅ Módulo Agenda V1 COMPLETO (2026-06-13): calendarios (slug, duración, reglas, location), disponibilidad semanal,
  página PÚBLICA /book/[slug] con motor de huecos (date-fns-tz, Europe/Madrid, respeta DST/aviso mínimo/ventana/buffers),
  reserva pública → contacto auto-creado + activity booking_created + cita; vista admin de citas próximas; dashboard con conteos reales.
  Tablas calendars/calendar_availability/bookings con RLS + índice anti-doble-reserva. Build OK. Verificado E2E.
  - Cliente service-role en src/lib/supabase/admin.ts para operaciones públicas (NUNCA importar en cliente).
  - /book está FUERA de (main) y no protegido por proxy (público). slugify quita acentos/espacios.
  - GOTCHA TZ: availability se guarda como wall-clock local + tz del calendario; slots se convierten a UTC con fromZonedTime.
- PENDIENTE (requieren acción del usuario):
  - Google Meet ÚNICO por cita: requiere OAuth Google (Google Cloud credentials del admin). Hoy usa enlace fijo configurable por calendario.
  - Emails de cita (confirmación + recordatorio) vía Resend: requiere verificar dominio propio en Resend para enviar a terceros.
- Existe 1 calendario de demo creado: slug 'descubrimiento' (lun-vie 10-18, 30min). Se puede borrar o quedar.

## Sesión autónoma 2026-06-13 (usuario ocupado, "dale con todo lo que puedas")
- ✅ Ajustes (/settings): editar nombre de perfil + cambiar contraseña (action changePassword en auth.ts).
- ✅ Infraestructura de emails: src/lib/email/client.ts (getResend) + src/features/notifications/services/booking-emails.ts.
  Conectado a createPublicBooking: envía confirmación al prospecto + notificación al admin (EMAIL_ADMIN en .env.local).
  NO bloquea la reserva si falla. Registra activity 'email_sent'. PENDIENTE: confirmación a terceros requiere verificar dominio en Resend
  (hoy solo llega al email del dueño de la cuenta Resend). La notificación al admin SÍ funciona ya.
- ✅ Módulo CURSOS completo (PRP-004, ver prp-cursos.md): 5 tablas (courses, course_modules, course_lessons,
  course_enrollments, course_lesson_progress) con RLS. Admin: /courses (grid), editor dos paneles /courses/[id]
  (módulos/lecciones, reordenar con flechas, publicar, 3 editores: vídeo embed/texto markdown/quiz single-choice JSONB).
  Alumno: /learn/[slug] (enroll por email+cookie httpOnly, visor, quiz interactivo, progreso) + certificado imprimible /learn/[slug]/certificate al 100%.
  Verificado E2E en browser (crear curso → publicar → alumno se inscribe → completa → certificado). Build OK.
  - GOTCHA cursos: lecturas/escrituras del alumno por service-role (createAdminClient), igual que /book. /courses protegido en proxy.
  - markdown casero en src/features/courses/services/markdown.ts (soporta #h1-3, negrita, cursiva, listas, enlaces). embed.ts normaliza YouTube/Vimeo/Bunny.
- Dependencias añadidas esta sesión: next-themes, lucide-react, papaparse, zod, date-fns, date-fns-tz, resend, pg(dev).
- PENDIENTE con intervención del usuario: (1) Google Calendar/Meet OAuth, (2) verificar dominio en Resend.
  Posibles siguientes autónomos: gestión de bookings (cancelar/reprogramar), mostrar cursos/citas/forms en ficha de contacto.

## Módulo AUTOMATIZACIONES de email completo (2026-06-13, PRP-005)
- ✅ Las 3 instancias de GHL ya replicadas: CRM+agenda, cursos, y AUTOMATIZACIONES (form→secuencia drip).
- 5 tablas (forms, automations, automation_steps, automation_triggers, scheduled_emails) con RLS.
- Admin /automations: CRUD formularios + secuencias; editor de pasos (delay días/horas + asunto + cuerpo); vincular forms trigger; activar/borrador.
- /form/[slug] público (service-role) → submitPublicForm: dedup contacto por email + activities form_submitted/enrolled + crea scheduled_emails.
- Motor: src/features/automations/services/email-engine.ts (enrollContactInAutomation con send_at acumulado, processDueEmails envía vencidos vía Resend).
- /api/cron/process-emails?token=CRON_SECRET (env nueva CRON_SECRET en .env.local) para disparar pasos futuros — CONFIGURAR cron (Vercel Cron / n8n / cron-job.org).
- Verificado E2E: form submit crea contacto + 2 scheduled_emails; día 0 procesado inline (failed por dominio Resend no verificado, ESPERADO); día 2 pending. Cron auth OK. Build OK.
- contact_activities.type ampliado con 'form_submitted' y 'enrolled' (iconos en ActivityTimeline).
- PENDIENTE usuario: verificar dominio Resend (envío a terceros) + configurar cron para delays>0. .env.local.example actualizado.

## Gestión de citas (2026-06-13, extensión del módulo Agenda)
- ✅ Página /calendars/bookings con pestañas Próximas/Pasadas/Canceladas (filtro por searchParam).
- ✅ Cancelar cita: status='cancelled' (libera el hueco; el índice anti-doble-reserva solo bloquea 'confirmed') + activity 'Cita cancelada'.
- ✅ Reprogramar: modal con selector de huecos (getRescheduleSlots excluye la propia cita) → rescheduleBooking actualiza starts_at/ends_at + activity 'Cita reprogramada'. TZ correcta (CEST).
- Actions nuevas en src/actions/calendars.ts: cancelBooking, getRescheduleSlots, rescheduleBooking. Servicio listBookings(filter) en scheduling/services/calendars.ts.
- Componente src/features/scheduling/components/BookingsTable.tsx (con RescheduleModal). /calendars enlaza "Gestionar citas".
- Verificado E2E: reprogramar (Lun15→Mié17), cancelar, aparece en Canceladas. Build OK.
- NOTA: emails de cancelación/reprogramación NO implementados (se pueden añadir cuando se verifique dominio Resend). Solo se registran activities.

## Vista 360° del contacto (2026-06-13)
- ✅ La ficha /contacts/[id] muestra, además del timeline: Citas (con estado), Cursos inscritos (con barra de progreso completadas/total), Emails de secuencia programados/enviados (con estado).
- Servicio getContactRelated(contactId) en contacts.ts (citas por contact_id, enrollments con progreso, scheduled_emails). Componente ContactRelated.tsx (presentacional).
- GOTCHA: Supabase infiere relaciones embebidas como array en TS → castear vía `as unknown as {...}` (runtime es objeto en to-one). Verificado E2E. Build OK.

## Deploy en VPS (2026-06-13) — PREPARADO, pendiente de VPS+dominio del usuario
- Plan: deploy en VPS propio con EasyPanel (skill easypanel-deploy existe pero es para Prisma/SQLite/NextAuth → ADAPTADA a Supabase).
- Preparado en repo: next.config.ts `output:'standalone'`; Dockerfile multi-stage (sin Prisma/volúmenes, node server.js); .dockerignore; DEPLOY.md (guía completa adaptada).
- Build standalone verificado (.next/standalone/server.js generado).
- GOTCHA CLAVE deploy: NEXT_PUBLIC_* (SUPABASE_URL, ANON_KEY, SITE_URL) se incrustan en BUILD → pasar como Build Args en EasyPanel. Runtime-only: SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_*, CRON_SECRET.
- NO se necesita DATABASE_URL en prod (app usa API Supabase; DATABASE_URL solo para scripts locales).
- PENDIENTE usuario: git init + push a GitHub (hoy NO es repo git), VPS+EasyPanel, dominio (registro A→IP VPS), config Site URL en Supabase, cron para /api/cron/process-emails.
