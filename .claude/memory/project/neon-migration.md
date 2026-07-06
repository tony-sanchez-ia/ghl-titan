# Migración Supabase → Neon (2026-07-01)

## Por qué
Supabase pausó el proyecto free por inactividad (el subdominio dejó de resolver en DNS).
Tony: "supabase se está quedando conmigo, quiero probar Neon". No había datos que conservar
(los 189 contactos se reimportan del CSV de referencias/).

## Arquitectura resultante
- **BD**: Neon Postgres 18 (proyecto `ep-patient-mud-asijl1zd`, eu-central-1). `DATABASE_URL` en `.env.local`
  (host directo; existe pooler host `...-pooler...` para serverless). Las viejas vars de Supabase quedaron
  en `.env.local.bak-supabase` (gitignored).
- **Capa de datos**: `src/lib/db.ts` — pg Pool singleton (global para sobrevivir HMR), `query<T>()` y `queryOne<T>()`.
  SQL parametrizado a pelo, sin ORM. pg está en dependencies (necesario para build standalone).
- **Auth propia** (admin único): tabla `users` (email, password_hash bcrypt). JWT HS256 (jose) en cookie
  httpOnly `session` (30 días), secreto `AUTH_SECRET`. Archivos: `src/lib/auth/jwt.ts` (edge-safe, lo usa
  el proxy) + `src/lib/auth/session.ts` (cookies). `/signup` solo crea cuenta si users está vacía (first-run).
  ELIMINADOS: forgot-password, update-password, check-email, callback, useAuth. Reset de contraseña:
  desde /settings logueado, o `node scripts/create-admin.js <email> <pass>` (upsert).
- **Sin RLS**: todo el acceso a datos es server-side (actions/servicios); ya no existe distinción
  anon/service-role. Los flujos públicos (/book, /form, /learn) usan las mismas query()/queryOne().
- **Esquema**: `db/migrations/0001_init.sql` (consolidado de las 5 migraciones de Supabase, sin auth.users
  ni policies; profiles → users con password_hash). Carpeta `supabase/` eliminada.
- **Scripts** (leen DATABASE_URL de .env.local): `run-sql.js` (igual), `query.js` (NUEVO: SQL inline con
  resultados), `create-admin.js` y `import-contacts.js` (reescritos a pg).
- **MCP**: quitado supabase de `.mcp.json`; añadido `neon` (remoto `https://mcp.neon.tech/mcp`, requiere
  OAuth del usuario vía /mcp la primera vez). Para SQL directo los scripts van más rápido que el MCP.

## Errores-tipo de las actions (gotcha)
Los componentes cliente esperan `{ error?: string }` — las actions que solo devuelven `{ success: true }`
llevan anotación explícita `Promise<{ success?: boolean; error?: string }>` para que TS no rompa.
Violación de unique en pg = error `code === '23505'` (helper isUniqueViolation en cada action file).

## Verificado E2E en browser (2026-07-01)
Login admin → dashboard (189 contactos) → reserva pública /book/descubrimiento (motor de huecos con
aviso 12h y fines de semana OK) → contacto auto-creado con timeline (booking_created + email_sent) y
cita visible en ficha 360 → form público → contacto + form_submitted/enrolled + 2 scheduled_emails
(día 0 failed por dominio Resend sin verificar = esperado; día 1 pending). Datos de prueba limpiados.
Build de producción OK. Admin: titanicfactorymedia@gmail.com / TitanAdmin2026!.

## Queda igual que antes
Resend (falta verificar dominio), cron para /api/cron/process-emails, Google Meet OAuth, deploy VPS.
DEPLOY.md actualizado a Neon (DATABASE_URL + AUTH_SECRET runtime; solo NEXT_PUBLIC_SITE_URL como build arg).

## Pedido de Tony (2026-07-01, con capturas de GHL) — HECHO
1. Automatizaciones VISUALES tipo GHL → PRP-006 COMPLETADO (ver prp-visual-automations.md):
   - Triggers múltiples: formulario enviado / cita reservada / etiqueta añadida (tabla automation_trigger_defs).
   - Pasos tipados en árbol (automation_nodes): send_email, wait, add_tag, add_note, branch_email_click.
   - Ejecución por puntero (automation_enrollments: current_node_id + next_run_at + wait_until). Motor en
     src/features/automations/services/engine.ts (fireTrigger/enroll/processEnrollments/resolveBranch).
   - Tracking de clicks: links reescritos a /r/[token] (anti open-redirect: destino validado contra el body).
   - Builder visual vertical (WorkflowBuilder.tsx, sin librería de canvas): triggers arriba, "+" entre pasos,
     ramas en 2 columnas "Hizo click / No hizo click", contadores enviados/clicks por email.
   - Migración db/migrations/0002 (convierte steps lineales legados; DROP automation_steps/automation_triggers).
   - Cron /api/cron/process-emails ahora también avanza inscripciones y expira ramas (sigue PENDIENTE configurarlo).
   - GOTCHA: add_tag desde un workflow NO dispara triggers tag_added (anti-bucle). Ramas sin merge en V1.
   - Demo en la instancia: automatización "Nutrición Leads" + form "Captación Web" (Borrador).
2. Reserva de calendario → contacto automático en CRM con historial: YA EXISTÍA y quedó verificado.
