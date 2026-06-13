# PRP-003: Módulo Agenda (Scheduling tipo Calendly)

> **Estado**: ✅ V1 COMPLETADA (Fases 1-4, 2026-06-13). Fases 5-6 (Google Meet auto + emails) pendientes de setup del usuario.
> **Fecha**: 2026-06-13
> **Proyecto**: GHL Titan (instancia Titanic Factory)
>
> Verificado E2E en browser: crear calendario + disponibilidad semanal → página pública /book/[slug] →
> reserva real → contacto auto-creado (dedup email) + activity booking_created + cita visible en admin y dashboard.
> TZ correcta (11:00 Madrid → 09:00 UTC en junio/CEST). Anti-doble-reserva verificado. Build de producción OK.

---

## Objetivo

Construir el módulo de agendación de GHL Titan: el admin define **calendarios** (tipos de cita con slug público, duración y reglas) y su **disponibilidad semanal**; un visitante público reserva en `/book/[slug]` viendo huecos libres reales, rellena el formulario y confirma. Al confirmar se crea/actualiza el **contacto** en el CRM (dedup por email), se registra una **activity `booking_created`** y se crea la **cita** (`booking`). El admin ve sus **citas próximas**. Zona horaria fija: **Europe/Madrid**.

## Por Qué

| Problema | Solución |
|----------|----------|
| GHL cobra ~$100/mes y su único uso real de agenda es capturar leads vía llamadas de descubrimiento | Página pública de reservas propia que alimenta el CRM existente sin coste de suscripción |
| Reservar a mano implica fricción y datos sueltos (email/teléfono fuera del CRM) | La reserva crea/actualiza el contacto y deja timeline de actividad automáticamente |
| El admin necesita ver qué citas tiene sin abrir GHL | Vista admin de citas próximas dentro de la misma plataforma |

**Valor de negocio**: Habilita el KPI central del proyecto — completar una reserva real de punta a punta (público → cita → contacto en CRM) para poder cancelar la suscripción de GoHighLevel (~$1.200/año).

## Qué

### Criterios de Éxito
- [ ] El admin puede crear/editar/eliminar un calendario (nombre, slug público único, duración, descripción, reglas: aviso mínimo, ventana de días, buffer antes/después, location) desde `/calendars`.
- [ ] El admin puede definir su disponibilidad semanal (franjas horarias por día de la semana) por calendario.
- [ ] `/book/[slug]` carga **sin sesión** y muestra solo huecos libres reales = disponibilidad semanal menos citas ya reservadas, respetando duración, buffers, aviso mínimo y ventana de días, en zona horaria Europe/Madrid.
- [ ] Al confirmar una reserva: se crea/actualiza el contacto (dedup por email), se inserta `contact_activities.type = 'booking_created'`, y se crea la fila en `bookings`. La operación es atómica y resistente a doble-reserva del mismo hueco.
- [ ] El admin ve un listado de citas próximas (contacto, calendario, fecha/hora, estado) en la UI admin.
- [ ] `npm run typecheck` y `npm run build` pasan; un screenshot de Playwright confirma `/book/[slug]` y la vista admin.

### Comportamiento Esperado (Happy Path)
1. Admin entra a `/calendars`, crea el calendario "Llamada de descubrimiento" (slug `descubrimiento`, 30 min, location = enlace fijo) y define disponibilidad L-V 10:00-14:00.
2. Un prospecto abre `citas.titanicfactory.com/book/descubrimiento` sin login.
3. Ve los días con huecos en los próximos N días; elige un día y ve las horas libres (huecos ocupados por citas existentes no aparecen).
4. Elige una hora, rellena nombre, apellidos, email y teléfono, y confirma.
5. El sistema: hace upsert del contacto por email → registra activity `booking_created` → crea la `booking` con la location del calendario → muestra pantalla de confirmación con los datos de la cita y la location.
6. El admin ve la cita en su vista de "Citas próximas" y, al abrir la ficha del contacto, ve la actividad `booking_created` en el timeline.

---

## Contexto

### Referencias (código existente — patrones a seguir)
- `src/actions/contacts.ts` — patrón de **server action** con Zod + `safeParse`, helpers `emptyToNull`/`parseTagsInput`, upsert con dedup (`onConflict`), e inserción de `contact_activities`. La lógica de upsert de contacto en booking debe imitar `importContactsFromCsv` pero dedup por **email**.
- `src/features/contacts/` — estructura **feature-first** de referencia (`components/`, `services/`, `types/`).
- `src/lib/supabase/server.ts` — cliente Supabase autenticado (cookies) para acciones del admin.
- `src/lib/supabase/proxy.ts` — middleware de rutas protegidas: **hay que excluir `/book`** de las rutas protegidas (no está hoy; las protegidas son `/dashboard`, `/contacts`, `/calendars`, `/settings`).
- `scripts/run-sql.js` — runner de migraciones (`node scripts/run-sql.js supabase/migrations/XXXX.sql`). Migración nueva = `supabase/migrations/0003_scheduling.sql`.
- `supabase/migrations/0002_contacts.sql` — patrón de tablas + índices + **RLS `auth.role() = 'authenticated'`** a copiar para tablas de admin.
- `scripts/import-contacts.js` y `scripts/create-admin.js` — patrón de uso de `SUPABASE_SERVICE_ROLE_KEY` desde Node con `@supabase/supabase-js` (no existe aún un cliente service-role en `src/lib`; hay que crearlo para la action pública).
- `src/shared/lib/ui.ts` — presets `ui.card / button / buttonPrimary / input` (design system CLÁSICO claro/oscuro). **No** Liquid Glass.
- `src/shared/components/sidebar.tsx` — navegación admin (ya existe link a Agenda/`/calendars`).
- `src/types/database.ts` — tipos centrales (`Contact`, `ContactActivity`, `Database`). Hay que añadir aquí `Calendar`, `CalendarAvailability`, `Booking` y extender `Database['public']['Tables']`.
- `.env.local` — ya tiene `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.

### Decisiones de Arquitectura (propuestas)
- **Ruta pública vs admin**: `/book/[slug]` vive fuera de `(main)` (sin sidebar, sin auth). Las pantallas admin viven en `(main)/calendars`. Hay que **modificar `proxy.ts`** para que `/book` NO sea ruta protegida.
- **Cálculo de huecos en el servidor**: la disponibilidad se calcula en una función pura en `services/` (TS), no en SQL, para poder testearla y razonarla. Input: availability semanal + bookings existentes + reglas + "ahora". Output: lista de slots libres por día. La página pública es Server Component que llama a esta función.
- **Zona horaria**: todo se almacena en UTC (`timestamptz`); la conversión a/desde Europe/Madrid se hace en una sola capa de utilidades. **No hay librería de fechas instalada** — decidir entre añadir una mínima (recomendado `date-fns` + `date-fns-tz`) o usar `Intl.DateTimeFormat` con `timeZone: 'Europe/Madrid'`. **Esto debe confirmarse con el usuario** (ver Gotchas). DST de Madrid (CET/CEST) es la razón por la que no basta con un offset fijo.
- **Reserva pública sin sesión**: la action de crear booking necesita escribir en `contacts`/`contact_activities`/`bookings`, todas con RLS `authenticated`. Sin sesión, el cliente con anon key **no pasa RLS**. Propuesta V1: usar un **cliente service-role server-side** (`src/lib/supabase/admin.ts`, server-only) dentro de una server action `createPublicBooking`, con validación Zod estricta y lectura del calendario por slug. Alternativa (policy de insert pública controlada) queda descartada por superficie de ataque mayor sobre `contacts`. La action debe re-validar disponibilidad del slot en el momento de confirmar (evitar doble reserva).
- **Atomicidad / doble-reserva**: la confirmación debe revalidar el slot y proteger contra dos visitantes reservando la misma hora. Propuesta: constraint de unicidad `(calendar_id, starts_at)` en `bookings` (estado activo) + manejo del error de conflicto devolviendo "ese hueco ya no está disponible". Confirmar el alcance del manejo de concurrencia con el usuario.

### Arquitectura Propuesta (Feature-First)
```
src/features/scheduling/
├── components/
│   ├── CalendarForm.tsx          # crear/editar calendario (admin)
│   ├── AvailabilityEditor.tsx    # franjas semanales por día (admin)
│   ├── CalendarsList.tsx         # listado de calendarios (admin)
│   ├── UpcomingBookings.tsx      # citas próximas (admin)
│   ├── BookingDatePicker.tsx     # selección de día (público)
│   ├── BookingSlots.tsx          # horas libres del día (público)
│   ├── BookingForm.tsx           # nombre/apellidos/email/teléfono (público)
│   └── BookingConfirmation.tsx   # pantalla de éxito (público)
├── services/
│   ├── availability.ts           # función pura: slots libres (testeable)
│   ├── timezone.ts               # utilidades Europe/Madrid <-> UTC
│   └── bookings.ts               # queries de lectura (calendarios por slug, citas próximas)
└── types/
    └── index.ts                  # Calendar, CalendarAvailability, Booking, Slot

src/actions/scheduling.ts          # createCalendar, updateCalendar, deleteCalendar,
                                   # setAvailability, createPublicBooking, cancelBooking
src/app/(main)/calendars/          # admin: lista, nuevo, [id]/edit, disponibilidad, citas próximas
src/app/book/[slug]/page.tsx       # PÚBLICA (fuera de (main), sin auth)
src/lib/supabase/admin.ts          # cliente service-role (server-only) para la action pública
```

### Modelo de Datos (propuesto — `supabase/migrations/0003_scheduling.sql`)
```sql
-- calendars: tipos de cita
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,                  -- usado en /book/[slug]
  description text,
  duration_min int not null default 30,
  min_notice_min int not null default 0,      -- aviso mínimo antes de reservar (minutos)
  window_days int not null default 30,        -- ventana de reserva hacia adelante (días)
  buffer_before_min int not null default 0,
  buffer_after_min int not null default 0,
  location_type text not null default 'custom_link',  -- 'google_meet' | 'custom_link' | 'in_person'
  location_value text,                        -- enlace fijo o dirección (V1: enlace configurable)
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- calendar_availability: franjas semanales por calendario
create table public.calendar_availability (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  weekday int not null,                       -- 0=domingo ... 6=sábado
  start_time time not null,                   -- hora local Europe/Madrid
  end_time time not null,
  created_at timestamptz default now() not null
);

-- bookings: citas reservadas
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete restrict not null,
  contact_id uuid references public.contacts(id) on delete set null,
  starts_at timestamptz not null,             -- UTC
  ends_at timestamptz not null,               -- UTC
  status text not null default 'confirmed',   -- 'confirmed' | 'cancelled'
  guest_first_name text,
  guest_last_name text,
  guest_email text,
  guest_phone text,
  location_type text,
  location_value text,
  google_event_id text,                       -- nullable; fase Google Meet
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.calendar_availability (calendar_id, weekday);
create index on public.bookings (calendar_id, starts_at);
create index on public.bookings (contact_id);
-- evita doble reserva del mismo slot activo
create unique index bookings_slot_unique on public.bookings (calendar_id, starts_at)
  where status = 'confirmed';

-- RLS: admin único autenticado (igual que contacts)
alter table public.calendars enable row level security;
alter table public.calendar_availability enable row level security;
alter table public.bookings enable row level security;

create policy "Authenticated full access calendars"
  on public.calendars for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access availability"
  on public.calendar_availability for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access bookings"
  on public.bookings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- NOTA: la página pública lee el calendario y crea la booking vía service-role en
-- la server action (bypassea RLS). No se abre policy de insert pública.
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (`/bucle-agentico`).
> Las Fases 5 y 6 son **dependencias externas** que requieren acción del usuario y NO bloquean el V1.

### Fase 1: Esquema de datos
**Objetivo**: Tablas `calendars`, `calendar_availability`, `bookings` con índices, constraint anti-doble-reserva y RLS; tipos TS en `src/types/database.ts`.
**Validación**: `node scripts/run-sql.js supabase/migrations/0003_scheduling.sql` OK; `list_tables` muestra las 3 tablas con RLS habilitado; `npm run typecheck` pasa.

### Fase 2: Admin de calendarios y disponibilidad
**Objetivo**: CRUD de calendarios y editor de disponibilidad semanal en `/calendars`, con server actions (`createCalendar`, `updateCalendar`, `deleteCalendar`, `setAvailability`) validadas con Zod. Reemplazar el stub actual de `/calendars`.
**Validación**: Crear un calendario y su disponibilidad desde la UI; persisten en BD; slug único respetado; screenshot de la pantalla admin.

### Fase 3: Motor de huecos + página pública de reserva
**Objetivo**: Función pura de cálculo de slots libres (disponibilidad − bookings − reglas, en Europe/Madrid), página pública `/book/[slug]` (date picker → slots → form), y exclusión de `/book` en `proxy.ts`. Cliente service-role `src/lib/supabase/admin.ts`.
**Validación**: `/book/[slug]` carga sin sesión; los huecos mostrados respetan duración, buffers, aviso mínimo y ventana; un hueco con booking existente no aparece; screenshot.

### Fase 4: Confirmación de reserva (contacto + activity + booking)
**Objetivo**: Server action `createPublicBooking`: revalida el slot, upsert del contacto por email, inserta activity `booking_created`, crea la `booking` con la location del calendario, maneja conflicto de doble-reserva; pantalla de confirmación; vista admin de citas próximas (`UpcomingBookings`).
**Validación**: Reserva E2E con Playwright: el contacto aparece/actualiza en CRM, la activity figura en el timeline, la booking aparece en citas próximas, y reservar el mismo hueco dos veces falla con mensaje claro. `npm run build` OK.

### Fase 5 (dependencia externa — Google Meet por cita): POSTERIOR
**Objetivo**: Auto-generar un Google Meet único por cita creando el evento en el Google Calendar del admin.
**Requiere del usuario**: credenciales de Google Cloud (OAuth client) y conectar la cuenta Google del admin. Tabla `google_credentials` (token cifrado).
**V1 entretanto**: el calendario usa `location_type` + `location_value` (enlace fijo configurable). Esta fase se aborda solo cuando el usuario aporte las credenciales.
**Validación**: una cita nueva genera evento en Google Calendar con enlace Meet único y lo guarda en `bookings.google_event_id`.

### Fase 6 (dependencia externa — Emails de confirmación + recordatorio vía Resend): POSTERIOR / PARCIAL
**Objetivo**: Email de confirmación al confirmar + recordatorio programado, vía Resend + React Email (patrón skill `add-emails`).
**Requiere del usuario**: verificar un **dominio propio** en Resend para poder enviar a terceros (prospectos). `RESEND_API_KEY` y `EMAIL_FROM` ya están en `.env.local`.
**V1 entretanto**: con dominio sin verificar, Resend solo permite enviar al propio email de registro — así que en V1 solo se notifica al admin (no al prospecto). El envío al prospecto se activa al verificar el dominio.
**Validación**: confirmación llega al destinatario permitido; activity `email_sent` registrada; recordatorio programado.

### Fase N: Validación Final (V1 = Fases 1-4)
**Objetivo**: Sistema de agenda funcionando end-to-end sin Google ni emails a terceros.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: reserva pública completa → contacto en CRM + activity + booking + cita en vista admin
- [ ] Criterios de Éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error encontrado durante la implementación.

_(vacío — se llena durante `/bucle-agentico`)_

---

## Gotchas

- [ ] **Zona horaria + DST**: Europe/Madrid alterna CET/CEST. No usar offset fijo. No hay librería de fechas instalada — **confirmar con el usuario** si se añade `date-fns` + `date-fns-tz` (recomendado) o se usa `Intl.DateTimeFormat`. Almacenar siempre en UTC (`timestamptz`).
- [ ] **`/book` debe salir de las rutas protegidas** en `src/lib/supabase/proxy.ts` (hoy solo protege `/dashboard|/contacts|/calendars|/settings`, pero `/book` debe quedar explícitamente público y no redirigir).
- [ ] **RLS bloquea inserts anónimos**: la reserva pública usa cliente **service-role** server-only (`src/lib/supabase/admin.ts`); nunca exponer la service-role key al cliente. Validación Zod estricta en `createPublicBooking`.
- [ ] **Dedup de contacto por email**: a diferencia del import (dedup por `ghl_contact_id`), la reserva deduplica por `email`. Contactos importados pueden tener email nulo/duplicado entre los 189 existentes — revisar antes de asumir unicidad. Considerar índice único parcial sobre `email` o upsert manual (select-then-insert/update).
- [ ] **Doble reserva**: índice único parcial `(calendar_id, starts_at) where status='confirmed'` + revalidación del slot en la action; capturar el error de conflicto y devolver mensaje amable.
- [ ] **Resend dominio sin verificar**: en V1 no se puede enviar al prospecto (solo al email de registro). No prometer email al prospecto hasta verificar dominio (Fase 6).
- [ ] **Buffers vs aviso mínimo**: el cálculo de slots debe restar buffers a ambos lados de cada booking y descartar slots cuyo inicio sea anterior a `now + min_notice_min`.

## Anti-Patrones

- NO calcular huecos en SQL crudo si se puede en una función pura testeable de `services/`.
- NO abrir una policy de insert pública sobre `contacts`/`bookings` (mayor superficie de ataque que el service-role acotado en una action validada).
- NO usar offset de hora fijo para Madrid (rompe en cambio de hora).
- NO usar `any` (usar `unknown`); NO omitir Zod en inputs del formulario público.
- NO bloquear el V1 esperando Google/Resend: Fases 5-6 son posteriores y dependen del usuario.
- NO crear nuevos patrones de server action/feature si los de `contacts` ya sirven.

---

*PRP pendiente aprobación. No se ha modificado código.*
