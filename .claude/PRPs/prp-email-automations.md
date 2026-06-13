# PRP-005: Módulo Automatizaciones de Email (Form → Secuencia de Emails)

> **Estado**: ✅ COMPLETADO (2026-06-13). Verificado E2E en browser + DB.
> **Fecha**: 2026-06-13
> **Proyecto**: GHL Titan
>
> Implementado: 5 tablas + RLS; CRUD admin de formularios y secuencias (editor de pasos con delay/asunto/cuerpo, trigger multi-form,
> activar/borrador); /form/[slug] público; submitPublicForm (dedup contacto, activities form_submitted+enrolled, scheduled_emails);
> motor processDueEmails() + enrollContactInAutomation (send_at acumulado); /api/cron/process-emails protegido por CRON_SECRET.
> Verificado: form submit → contacto + 2 emails programados; día 0 procesado inline (failed con error de dominio Resend ESPERADO),
> día 2 pending con send_at correcto; cron 401 sin token / 200 con token. Build OK.
> LIMITACIÓN: envío a terceros requiere verificar dominio en Resend (hoy solo al email dueño de la cuenta). Pasos delay>0 requieren cron externo.

---

## Objetivo

Replicar la 3ª instancia de GHL del usuario: un visitante rellena un **formulario público**, eso crea/actualiza un **contacto** en el CRM y lo inscribe en una **automatización** (secuencia drip de emails). Un **motor de envío** programa un email por paso (`send_at = alta + delay acumulado`) y los envía vía Resend cuando vencen, registrando la actividad en el contacto.

## Por Qué

| Problema | Solución |
|----------|----------|
| El admin captura leads a mano y no hay seguimiento automático | Formulario público que da de alta el contacto sin intervención |
| No existe nurturing: los leads se enfrían sin contacto | Secuencias drip (día 0, 2, 5…) que envían emails solos |
| El usuario ya paga una 3ª instancia de GHL solo para esto | Consolidar form→automatización→drip dentro de GHL Titan |

**Valor de negocio**: Elimina una suscripción externa de GHL y automatiza el follow-up de leads (más conversiones con cero trabajo manual por lead).

## Qué

### Criterios de Éxito
- [ ] El admin crea/edita/borra **formularios** (nombre, slug, descripción) y **automatizaciones** (nombre, estado activo/borrador, pasos ordenados con delay + asunto + cuerpo) desde el panel.
- [ ] Una automatización se vincula a uno o varios formularios como trigger.
- [ ] `/form/[slug]` es pública, renderiza el formulario (nombre + email + teléfono + mensaje opcional) y al enviar: crea/actualiza el contacto (dedup por email), registra `activity`, y crea las `scheduled_emails` de la automatización vinculada.
- [ ] `processDueEmails()` envía los `scheduled_emails` vencidos (`send_at <= now` y `status = pending`) vía Resend, marca `sent`/`failed`, y registra `activity` `email_sent`. Se llama inline tras la inscripción (envía los de día 0 al instante).
- [ ] `GET /api/cron/process-emails?token=...` protegido por token dispara `processDueEmails()` para los pasos con delay > 0.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (lead):**
1. Visitante abre `/form/captura-leads`, rellena nombre + email + teléfono + mensaje y envía.
2. Server action (service-role): dedup por email → crea o actualiza `contacts`; `activity` `form_submitted`.
3. Busca la automatización activa vinculada al formulario. Por cada paso ordenado calcula `send_at = now + delay acumulado` e inserta una fila en `scheduled_emails` (status `pending`). Registra `activity` `enrolled`.
4. Llama `processDueEmails()` inline → los pasos con delay 0 se envían inmediatamente (status `sent`, `activity` `email_sent`).
5. El visitante ve confirmación de envío.

**Happy path (pasos futuros):**
6. Un cron (Vercel Cron o n8n) llama `GET /api/cron/process-emails?token=...` periódicamente.
7. `processDueEmails()` selecciona los `scheduled_emails` ya vencidos y pendientes, los envía, marca estado y registra actividad.

**Admin:**
- Lista/CRUD de formularios y automatizaciones, editor de pasos (añadir/reordenar/eliminar, delay en días u horas, asunto, cuerpo), y selector de formularios trigger.

---

## Contexto

### Referencias (patrones reales a replicar — no inventar nuevos)
- `src/actions/calendars.ts` (`createPublicBooking`, líneas 173-318) — **patrón canónico**: service-role + dedup contacto por email (`ilike`) + `contact_activities` + llamada a servicio de email no-bloqueante. El form público debe clonar esta estructura.
- `src/app/book/[slug]/page.tsx` — patrón de página pública (`force-dynamic`, `generateMetadata`, `notFound()`). `/form/[slug]` lo replica.
- `src/lib/supabase/admin.ts` (`createAdminClient`) — cliente service-role para rutas públicas sin sesión.
- `src/features/notifications/services/booking-emails.ts` — patrón de envío con `getResend()`, `EMAIL_FROM`, `EMAIL_ADMIN`, shell HTML, try/catch no-bloqueante. El motor de envío reutiliza `shell()` y este estilo.
- `src/lib/email/client.ts` — `getResend()`, `EMAIL_FROM`, `EMAIL_ADMIN`.
- `src/actions/contacts.ts` — CRUD con Zod + `revalidatePath` + `safeParse` (patrón de server actions admin).
- `supabase/migrations/0004_courses.sql` — patrón de tablas relacionadas ordenables (`position`), RLS `auth.role()='authenticated'`, índices. La migración `0005` lo sigue.
- `src/lib/supabase/proxy.ts` — añadir el nuevo prefijo admin a `isProtectedRoute`. `/form` y `/api/cron` quedan FUERA (públicos).
- `src/shared/components/sidebar.tsx` — añadir item de navegación (icono `lucide-react`, p.ej. `Mail` o `Zap`).
- `src/shared/lib/ui.ts` — presets `ui.card`, `ui.button`, `ui.buttonPrimary`, `ui.input`.
- `src/types/database.ts` — añadir tipos nuevos y registrarlos en `Database`.
- Migraciones se aplican con `node scripts/run-sql.js` (última `0004_courses.sql` → siguiente `0005`).

### Arquitectura Propuesta (Feature-First)
```
src/features/automations/
├── components/        # FormBuilder admin, StepEditor, AutomationList, PublicForm
├── services/
│   ├── forms.ts            # lecturas: getPublicFormBySlug, listForms...
│   ├── automations.ts      # lecturas admin de automatizaciones + pasos
│   └── email-engine.ts     # processDueEmails(), enrollContactInAutomation(), shell HTML
└── types/             # (o centralizar en src/types/database.ts siguiendo el patrón actual)

src/actions/automations.ts   # server actions admin (CRUD forms, automations, steps) + submitPublicForm
src/app/(main)/automations/  # panel admin (list, new, [id] editor)
src/app/form/[slug]/page.tsx # página PÚBLICA del formulario
src/app/api/cron/process-emails/route.ts  # GET protegido por token
supabase/migrations/0005_automations.sql
```

> Nota de simplicidad (Comportamiento 2): el proyecto centraliza tipos en `src/types/database.ts` en vez de carpetas `types/` por feature. Seguir esa convención salvo justificación.

### Modelo de Datos (`0005_automations.sql`)
```sql
-- Formularios públicos de captura
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  -- V1: campos fijos (nombre+email+teléfono+mensaje). No builder de campos.
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Automatizaciones (secuencias drip)
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',   -- 'draft' | 'active'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Pasos de la secuencia (ordenados; delay acumulado tras el paso anterior / alta)
create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  position integer not null default 0,
  delay_value integer not null default 0,
  delay_unit text not null default 'days', -- 'days' | 'hours'
  subject text not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- Vínculo form ↔ automatización (un form puede disparar varias; una automatización varios forms)
create table public.automation_triggers (
  automation_id uuid references public.automations(id) on delete cascade not null,
  form_id uuid references public.forms(id) on delete cascade not null,
  primary key (automation_id, form_id)
);

-- Emails programados (una fila por paso al inscribir un contacto)
create table public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  step_id uuid references public.automation_steps(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  to_email text not null,
  subject text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed'
  sent_at timestamptz,
  error text,
  created_at timestamptz default now() not null
);

create index on public.automation_steps (automation_id, position);
create index on public.scheduled_emails (status, send_at);
create index on public.scheduled_emails (contact_id);

-- RLS: admin único autenticado (mismo patrón que el resto del proyecto)
alter table public.forms enable row level security;
alter table public.automations enable row level security;
alter table public.automation_steps enable row level security;
alter table public.automation_triggers enable row level security;
alter table public.scheduled_emails enable row level security;

-- 5 policies "Authenticated full access ..." con using/with check auth.role()='authenticated'
-- (El form público y el cron escriben con service-role, que salta RLS.)
```

> `contact_activities.type` es `text` libre → añadir valores `'form_submitted'`, `'enrolled'`, `'email_sent'` (este ya existe). Sin cambio de schema, solo en `ContactActivityType`.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Base de datos y tipos
**Objetivo**: Tablas, índices y RLS creados; tipos TS añadidos a `src/types/database.ts` y registrados en `Database`.
**Validación**: `node scripts/run-sql.js` aplica `0005` sin error; `npm run typecheck` pasa; tablas visibles en Supabase.

### Fase 2: CRUD admin de formularios y automatizaciones
**Objetivo**: Server actions (`src/actions/automations.ts`) + páginas admin `(main)/automations/` para crear/editar/borrar formularios, automatizaciones, pasos (editor con delay + asunto + cuerpo, reordenable) y vincular forms trigger. Sidebar + proxy actualizados.
**Validación**: Crear una automatización con 2 pasos vinculada a un form se persiste y reabre correctamente; rutas admin protegidas; Playwright screenshot del editor.

### Fase 3: Formulario público + inscripción
**Objetivo**: `/form/[slug]` pública + `submitPublicForm` (service-role) que deduplica contacto por email, registra `activity` `form_submitted`, y crea `scheduled_emails` (una por paso, `send_at` = alta + delay acumulado) registrando `enrolled`.
**Validación**: Enviar el form crea/actualiza el contacto y genera N filas `scheduled_emails` pending con `send_at` correctos; actividades en el timeline del contacto.

### Fase 4: Motor de envío + cron
**Objetivo**: `processDueEmails()` en `email-engine.ts` (selecciona vencidos+pending, envía vía Resend reusando el shell de `booking-emails`, marca `sent`/`failed`+`error`, registra `email_sent`). Llamada inline tras inscripción. `GET /api/cron/process-emails?token=...` protegido por env token.
**Validación**: Tras enviar un form con un paso día 0, ese email queda `sent` inline; un paso futuro queda `pending` y se procesa al llamar la API route con token válido; token inválido → 401.

### Fase 5: Validación final
**Objetivo**: Pipeline form→contacto→inscripción→scheduled→procesador→marcado+activity funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: enviar `/form/[slug]` → contacto creado + scheduled_emails + (con dominio verificado) email entregado
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

_(vacío — pendiente de implementación)_

---

## Gotchas

- [ ] **Resend / dominio**: hasta verificar dominio en Resend, `onboarding@resend.dev` solo entrega al email dueño de la cuenta (`EMAIL_ADMIN`). El envío a leads (terceros) fallará/silenciará. El pipeline completo (form→contacto→inscripción→scheduled→procesador→marcado+activity) es construible y testeable igual; el `status` quedará `failed` con `error` registrado hasta verificar dominio. **Documentar esto en el panel admin.**
- [ ] **Pasos con delay > 0 requieren cron**: sin el cron llamando `/api/cron/process-emails`, solo se envían los pasos día 0 (inline). Documentar en el panel y/o README cómo configurar Vercel Cron o n8n.
- [ ] **Token del cron**: usar una env var nueva (p.ej. `CRON_SECRET`); añadir a `.env.local` / `.env.local.example`. Nunca hardcodear. Comparar de forma segura y devolver 401 si no coincide.
- [ ] **Service-role salta RLS**: el form público y el cron usan `createAdminClient()` (sin sesión). Mantener su uso ACOTADO a estas rutas, igual que `/book`. Nunca importar el admin client desde componentes cliente.
- [ ] **Dedup por email**: usar `ilike(email)` + `maybeSingle()` exactamente como `createPublicBooking`. El email vacío no debe crear contactos basura (el form público exige email).
- [ ] **`send_at` acumulado**: el delay de cada paso es relativo al paso anterior (o al alta para el primero). Calcular acumulado con `date-fns`, no delay aislado por paso.
- [ ] **`processDueEmails` no-bloqueante en el form**: si el envío inline falla, la inscripción y el contacto ya están persistidos; no romper la respuesta al visitante (patrón de `sendBookingEmails`).
- [ ] **Reentrancia del cron**: marcar `status` a `sent`/`failed` por fila para no reenviar; filtrar siempre `status = 'pending'` y `send_at <= now()`.
- [ ] **Solo automatizaciones `active`**: un form vinculado a una automatización en `draft` no debe inscribir ni programar emails.

## Anti-Patrones

- NO crear un builder de campos dinámicos en V1 (campos fijos: nombre, email, teléfono, mensaje).
- NO inventar un cliente de email nuevo: reusar `src/lib/email/client.ts` y el shell de `booking-emails.ts`.
- NO crear un cliente Supabase nuevo para rutas públicas: usar `createAdminClient()`.
- NO usar `any` (usar `unknown`); validar todos los inputs con Zod.
- NO omitir RLS en las tablas nuevas.
- NO hardcodear el token del cron ni los emails.
- NO refactorizar `calendars.ts`/`contacts.ts`; solo replicar sus patrones.

---

*PRP pendiente aprobación. No se ha modificado código.*
