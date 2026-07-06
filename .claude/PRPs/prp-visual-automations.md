# PRP-006: Automatizaciones Visuales tipo GHL (motor generalizado + builder vertical + clicks con ramas)

> **Estado**: COMPLETADO (2026-07-01, verificado E2E en browser)
> **Fecha**: 2026-07-01
> **Proyecto**: GHL Titan
> **Sucede a**: PRP-005 (form → drip de emails), que queda ABSORBIDO por este motor generalizado.

---

## Objetivo

Evolucionar el módulo de automatizaciones (hoy: formulario → secuencia lineal de emails) a un **motor de workflows tipo GoHighLevel**: varios disparadores por automatización (formulario enviado, reserva creada, etiqueta añadida), pasos tipados (enviar email, esperar, añadir etiqueta, añadir nota, rama por click), un **constructor visual vertical** (trigger arriba → tarjetas de pasos conectadas → botón "+" entre pasos → ramas Sí/No en dos columnas), y **tracking de clicks en los emails** que permite ramificar la secuencia según el contacto haga click o no.

## Por Qué

| Problema | Solución |
|----------|----------|
| Las secuencias actuales solo se disparan por formulario y solo envían emails | Motor generalizado: triggers múltiples (form, reserva, etiqueta) y acciones tipadas (email, espera, etiqueta, nota, rama) |
| El editor actual es una lista de tarjetas de texto: no se "ve" el flujo como en GHL | Constructor visual vertical estilo GHL: el usuario ve el recorrido completo del contacto de arriba a abajo |
| No hay forma de saber si un lead interactúa con los emails, ni de reaccionar a ello | Tracking de clicks por email enviado + rama Sí/No ("hizo click" / "no hizo click en N días") |
| El motor actual pre-programa TODOS los emails al inscribir → imposible ramificar después | Ejecución por inscripción (enrollment) con puntero al paso actual: cada paso se decide en su momento |

**Valor de negocio**: cubre el último gran caso de uso por el que Tony mantiene GHL ($100/mes): workflows visuales con seguimiento de engagement. Con esto puede replicar sus automatizaciones reales (drip 1/día con ramas por click) y acercarse a cancelar la suscripción.

## Qué

### Criterios de Éxito
- [ ] Una automatización admite **varios triggers** a la vez, de 3 tipos: *formulario enviado* (elige form), *reserva creada* (elige calendario o todos), *etiqueta añadida* (escribe la etiqueta). Los triggers existentes por formulario siguen funcionando tras la migración.
- [ ] Los pasos son **tipados**: `send_email` (asunto+cuerpo), `wait` (N días/horas), `add_tag`, `add_note`, `branch_email_click` (rama Sí/No con ventana de espera de N días/horas). Cada tipo se ejecuta correctamente y registra su actividad en el timeline del contacto.
- [ ] **Constructor visual vertical**: trigger(s) arriba, tarjetas de pasos conectadas con línea vertical, botón "+" entre pasos para insertar (con selector de tipo), la rama se dibuja en **dos columnas Sí/No** cada una con su propia cadena de pasos. Se puede editar, insertar en medio y borrar cualquier paso.
- [ ] **Tracking de clicks**: los links del cuerpo del email se reescriben a una URL de tracking propia; al hacer click se registra `email_clicked` en el timeline, se marca el email como clickeado, y el visitante llega al destino original (redirect).
- [ ] **Ramas funcionales**: si el contacto hace click dentro de la ventana → sigue la rama **Sí** de inmediato; si expira la ventana sin click → sigue la rama **No**. Verificado end-to-end.
- [ ] Un contacto inscrito avanza paso a paso (enrollment con puntero + `next_run_at`); el cron procesa pasos vencidos y ventanas de rama expiradas. Un mismo contacto no se inscribe dos veces en la misma automatización mientras tiene una inscripción activa.
- [ ] Migración sin pérdida: la automatización existente (pasos lineales) queda convertida a nodos equivalentes y los `scheduled_emails` pendientes no se pierden.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (construcción):**
1. Admin abre `/automations/[id]`: ve el flujo vertical. Arriba, la tarjeta de triggers ("Cuándo empieza"): añade *Formulario enviado → Captación* y *Reserva creada → Descubrimiento*.
2. Pulsa "+" bajo el trigger → elige "Enviar email" → escribe asunto/cuerpo (con un link a su web).
3. Pulsa "+" → "Rama por click" → configura "esperar 2 días el click".
4. En la columna **Sí** añade un email de oferta; en la columna **No**, un email de recordatorio y una etiqueta `frio`.
5. Activa la automatización.

**Happy path (ejecución):**
6. Un visitante envía el formulario Captación → se crea/actualiza el contacto → se crea una **inscripción** (enrollment) apuntando al primer paso con `next_run_at = ahora`.
7. El procesador (inline al inscribir + cron) ejecuta el paso: envía el email vía Resend **reescribiendo los links** con token de tracking, registra `email_sent`, avanza el puntero.
8. Llega a la rama por click → la inscripción queda **esperando** con `wait_until = ahora + 2 días`.
9. El contacto hace click en el email → `GET /r/[token]` registra `email_clicked`, despierta la inscripción por la rama **Sí** (`next_run_at = ahora`) y redirige al destino real. Si NO hace click, el cron detecta `wait_until` vencido y sigue por la rama **No**.
10. La rama continúa paso a paso hasta terminar → inscripción `completed`. Todo el recorrido queda en el timeline del contacto.

**Triggers restantes:**
- *Reserva creada*: al confirmarse una reserva pública en `/book/[slug]` se inscribe el contacto en las automatizaciones activas con ese trigger.
- *Etiqueta añadida*: al guardar un contacto con una etiqueta nueva que coincide con la configurada, se inscribe.

---

## Contexto

> ⚠️ **El proyecto ya NO usa Supabase** (migrado a Neon el 2026-07-01, ver `.claude/memory/project/neon-migration.md`). Capa de datos: `src/lib/db.ts` (`query`/`queryOne`, pg parametrizado, sin ORM, sin RLS — todo server-side). Migraciones en `db/migrations/` aplicadas con `node scripts/run-sql.js`.

### Referencias (patrones reales a replicar — no inventar nuevos)
- `src/features/automations/services/email-engine.ts` — motor actual: `enrollContactInAutomation` (pre-programa todo, **a reemplazar** por enrollment con puntero) y `processDueEmails` (envío Resend + marcado sent/failed + activity; **se conserva** como etapa de envío).
- `src/features/automations/services/queries.ts` — lecturas admin (`getAutomationForEdit`, `getActiveAutomationForForm` → generalizar a triggers tipados).
- `src/actions/automations.ts` — server actions con Zod + `revalidatePath` + `isUniqueViolation`; `submitPublicForm` es el punto de enganche del trigger `form_submitted`.
- `src/actions/calendars.ts` (`createPublicBooking`, ~línea 174-320) — punto de enganche del trigger `booking_created` (tras insertar `contact_activities` `booking_created`).
- `src/actions/contacts.ts` (`createContact`/`updateContact`, `parseTagsInput`) — punto de enganche del trigger `tag_added` (diff de tags antes/después de guardar).
- `src/features/automations/components/AutomationEditor.tsx` — editor actual (lista plana); se sustituye por el builder vertical. Reusar sus patrones: `run()` + `router.refresh()`, guardado onBlur, `confirm()` para borrar.
- `src/app/api/cron/process-emails/route.ts` — patrón de cron protegido por `CRON_SECRET`; se amplía para procesar inscripciones.
- `src/types/database.ts` — tipos centralizados (NO carpetas types/ por feature). `ContactActivityType` gana `'email_clicked'` y `'tag_added'`.
- `src/shared/lib/ui.ts` — presets `ui.card`, `ui.button`, `ui.buttonPrimary`, `ui.input`. Design system CLÁSICO claro/oscuro, acento azul; iconos lucide-react.
- `db/migrations/0001_init.sql` líneas 161-216 — schema actual de automatizaciones (forms, automations, automation_steps, automation_triggers, scheduled_emails).
- `.env.local.example` — `NEXT_PUBLIC_SITE_URL` ya existe: base para las URLs de tracking `/r/[token]`.
- `referencias/` — pantallazos del builder real de GHL de Tony (validar el look del builder vertical contra ellos).
- Errores-tipo: actions que solo devuelven `{ success: true }` necesitan anotación explícita `Promise<{ success?: boolean; error?: string }>` (gotcha Neon-migration).

### Arquitectura Propuesta (Feature-First)
```
src/features/automations/
├── components/
│   ├── WorkflowBuilder.tsx      # NUEVO: canvas vertical (triggers + cadena de nodos + ramas 2 columnas)
│   ├── NodeCard.tsx / TriggerCard.tsx / AddNodeButton.tsx (selector de tipo)
│   ├── NodeConfigPanel.tsx      # edición inline/panel del nodo seleccionado
│   ├── FormEditor.tsx, PublicForm.tsx (sin cambios)
│   └── AutomationEditor.tsx     # ELIMINADO (sustituido por WorkflowBuilder)
├── services/
│   ├── engine.ts                # NUEVO motor: enroll, processEnrollments (ejecutores por tipo de nodo), fireTrigger
│   ├── email-engine.ts          # se reduce a envío: processDueEmails + shell() + reescritura de links
│   └── queries.ts               # + getWorkflowForEdit (nodos en árbol), listas con contadores

src/actions/automations.ts       # CRUD de triggers tipados y nodos (add/update/delete/insert-between)
src/app/r/[token]/route.ts       # NUEVO: redirect público de tracking de clicks
src/app/api/cron/process-emails/route.ts  # amplía: processEnrollments() + processDueEmails()
db/migrations/0002_visual_automations.sql
```

### Modelo de Datos (`db/migrations/0002_visual_automations.sql`)
```sql
-- Triggers tipados (reemplaza automation_triggers form-only)
create table automation_trigger_defs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  type text not null,              -- 'form_submitted' | 'booking_created' | 'tag_added'
  config jsonb not null default '{}',  -- { form_id } | { calendar_id | null=todos } | { tag }
  created_at timestamptz default now() not null
);

-- Nodos del workflow (árbol vertical: cadena raíz + subcadenas de rama)
create table automation_nodes (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  parent_node_id uuid references automation_nodes(id) on delete cascade, -- null = cadena raíz
  branch text,                     -- null | 'yes' | 'no' (solo hijos de branch_email_click)
  position integer not null default 0,
  type text not null,              -- 'send_email' | 'wait' | 'add_tag' | 'add_note' | 'branch_email_click'
  config jsonb not null default '{}',
  -- send_email: { subject, body } · wait: { delay_value, delay_unit }
  -- add_tag: { tag } · add_note: { note } · branch_email_click: { wait_value, wait_unit }
  created_at timestamptz default now() not null
);
create index on automation_nodes (automation_id, parent_node_id, branch, position);

-- Inscripciones: un contacto recorriendo una automatización (puntero + agenda)
create table automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  status text not null default 'active',  -- 'active' | 'waiting_click' | 'completed' | 'cancelled'
  current_node_id uuid references automation_nodes(id) on delete set null,
  next_run_at timestamptz,                -- cuándo ejecutar el nodo actual
  wait_until timestamptz,                 -- deadline de la rama por click
  waiting_email_id uuid,                  -- scheduled_email cuyo click se espera
  context jsonb not null default '{}',    -- { email, trigger_type, ... }
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index on automation_enrollments (status, next_run_at);
create index on automation_enrollments (contact_id);
-- dedup: solo una inscripción viva por contacto+automatización
create unique index automation_enrollments_active_uniq
  on automation_enrollments (automation_id, contact_id)
  where status in ('active','waiting_click');

-- scheduled_emails se conserva como bandeja de salida + tracking
alter table scheduled_emails alter column step_id drop not null;  -- legado
alter table scheduled_emails
  add column node_id uuid references automation_nodes(id) on delete set null,
  add column enrollment_id uuid references automation_enrollments(id) on delete set null,
  add column click_token text unique,
  add column clicked_at timestamptz;
create index on scheduled_emails (click_token);

-- CONVERSIÓN de datos existentes (misma migración):
-- 1) automation_steps → por cada paso: nodo 'wait' (si delay>0) + nodo 'send_email' en la cadena raíz.
-- 2) automation_triggers (form) → automation_trigger_defs type 'form_submitted'.
-- 3) DROP automation_steps y automation_triggers al final (los scheduled_emails pendientes
--    sobreviven: step_id ya es nullable y el drop de tabla NO borra filas referenciadas,
--    solo hay que soltar la FK antes: alter table scheduled_emails drop constraint <fk_step>).
```

> `contact_activities.type` es `text` libre → añadir `'email_clicked'` y `'tag_added'` solo en `ContactActivityType` (sin cambio de schema).

### Decisiones de arquitectura (con alternativas descartadas)
1. **Ejecución por puntero, no pre-programada**: las ramas dependen de eventos futuros (click), así que ya no se pueden crear todos los emails al inscribir. Cada inscripción guarda "en qué nodo voy y cuándo toca". `scheduled_emails` pasa de "agenda completa" a "bandeja de salida + registro de tracking".
2. **Builder vertical con Tailwind, sin librería de canvas** (nada de react-flow/xyflow): GHL es una lista vertical con ramas en columnas; se dibuja con flexbox + bordes. Menos dependencias, estilo consistente con `ui.ts`.
3. **Ramas sin merge en V1**: cada rama termina la automatización por su lado (como el uso real de Tony en GHL). Simplifica árbol y motor. Merge = fase futura si hace falta.
4. **Un token de click por email enviado** (no por link): cualquier link clickeado cuenta como "hizo click". Se reescriben TODAS las URLs http(s) del cuerpo a `/r/[token]?u=<destino>`; el token identifica el `scheduled_email`. Suficiente para la rama Sí/No y mucho más simple que tracking por-link.
5. **Triggers como filas tipadas** (`type` + `config` jsonb): añadir un 4º tipo de trigger mañana no requiere migración de schema.
6. **El envío sigue en `processDueEmails`**: el nodo `send_email` inserta en `scheduled_emails` con `send_at = now` y se procesa inline → se reutiliza todo el circuito Resend/failed/activity ya verificado.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Base de datos y tipos
**Objetivo**: Migración `0002_visual_automations.sql` aplicada (tablas nuevas, columnas de tracking, conversión de steps/triggers existentes, drop de tablas legadas) y tipos TS en `src/types/database.ts` actualizados (nodos, triggers, enrollments, activity types nuevos).
**Validación**: `node scripts/run-sql.js db/migrations/0002_visual_automations.sql` sin error; `node scripts/query.js` confirma que la automatización existente quedó convertida a nodos y sus triggers migrados; `npm run typecheck` pasa (con el código legado adaptado mínimamente o la fase 2 en curso).

### Fase 2: Motor generalizado (triggers + ejecución por nodos)
**Objetivo**: `engine.ts` con `fireTrigger(type, config-match, contactId, email)`, `enroll()` (dedup activa) y `processEnrollments()` (ejecutores: send_email→scheduled_emails+envío inline, wait→next_run_at, add_tag/add_note→update+activity, branch→waiting_click/timeout por rama No). Triggers enganchados en `submitPublicForm`, `createPublicBooking` y save de contactos (tag añadida). Cron ampliado a `processEnrollments()+processDueEmails()`. Server actions CRUD de triggers y nodos (crear, editar config, insertar entre dos, borrar).
**Validación**: script/SQL de prueba: inscribir un contacto en una automatización lineal (email→wait→email) y ver que avanza paso a paso con `next_run_at` correcto; reserva pública y tag añadida inscriben; contacto ya inscrito no se duplica; typecheck pasa.

### Fase 3: Tracking de clicks + ramas
**Objetivo**: reescritura de links al enviar (token único por `scheduled_email`), ruta pública `GET /r/[token]` (marca `clicked_at`, activity `email_clicked`, despierta la inscripción por rama Sí, redirect 302 al destino), y resolución de rama No por timeout en el cron.
**Validación**: enviar email de prueba con link → la URL del cuerpo apunta a `/r/...`; abrir la URL registra el click en el timeline y redirige; inscripción esperando salta a rama Sí; con `wait_until` vencido y sin click, el cron la manda por rama No.

### Fase 4: Constructor visual vertical
**Objetivo**: `WorkflowBuilder` reemplaza a `AutomationEditor`: tarjeta de triggers (añadir/quitar, selector por tipo con form/calendario/etiqueta), cadena vertical de tarjetas de nodo con conector, "+" entre nodos con selector de tipo, edición de config por nodo, rama en dos columnas Sí/No con sus propios "+", contadores básicos por nodo de email (enviados/clicks). Responsive y modo noche.
**Validación**: Playwright: construir en el browser el flujo del happy path (trigger + email + rama + pasos en ambas columnas), recargar y ver que persiste; screenshot comparable a los pantallazos de `referencias/`.

### Fase 5: Validación final end-to-end
**Objetivo**: pipeline completo funcionando: form/reserva/tag → inscripción → email con links trackeados → click (o timeout) → rama correcta → fin `completed`, todo visible en el timeline del contacto.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: recorrido E2E del happy path (con la ventana de rama en horas/minutos cortos para poder probar el timeout)
- [ ] Datos de prueba limpiados (preferencia de Tony)
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### 2026-07-01: No borrar .next con el dev server corriendo
- **Error**: `rm -rf .next` antes de un typecheck con `next dev` activo → el server sirve 500 (ENOENT routes-manifest.json).
- **Fix**: reiniciar el dev server tras limpiar la caché (o pararlo antes de borrarla).
- **Aplicar en**: todos los proyectos (variante del gotcha .next de CLAUDE.md).

### 2026-07-01: ON CONFLICT con índice único parcial
- **Error potencial**: el dedup de inscripciones usa un unique index parcial (`where status in (...)`).
- **Fix**: `on conflict (cols) where <mismo predicado> do nothing` — Postgres exige repetir el predicado del índice.
- **Aplicar en**: cualquier upsert contra índices parciales.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **Neon, no Supabase**: nada de `createAdminClient`/RLS/supabase-js. Todo con `query`/`queryOne` de `src/lib/db.ts`. Migraciones con `node scripts/run-sql.js`.
- [ ] **No perder los `scheduled_emails` pendientes en la migración**: soltar la FK `step_id` (drop constraint) ANTES de tocar/dropear `automation_steps`; jamás borrar filas de steps con la FK on-delete-cascade viva.
- [ ] **Dominio Resend sin verificar** (pendiente de Tony): los envíos a terceros seguirán `failed`. El motor debe avanzar la inscripción aunque el envío falle (el fallo se registra en el email, no bloquea el workflow). Probar E2E con el email del admin.
- [ ] **`NEXT_PUBLIC_SITE_URL` en las URLs de tracking**: en dev desde la LAN debe ser `http://192.168.1.20:3000` o los links del email no funcionarán desde otra máquina. Documentar en el panel.
- [ ] **Redirect abierto**: `/r/[token]?u=...` NO debe redirigir a cualquier `u` arbitrario sin validar el token: buscar el token en BD y usar la URL destino guardada/verificada; si el token no existe → 404. No confiar solo en el query param.
- [ ] **Cron imprescindible** (ya pendiente de configurar): sin cron no avanzan los `wait` ni expiran las ramas No. El procesado inline al inscribir solo cubre el primer tramo inmediato. Mantener el aviso en el panel.
- [ ] **Reentrancia/idempotencia del procesador**: seleccionar inscripciones `next_run_at <= now` y actualizar puntero + `next_run_at` en la MISMA pasada antes de continuar; límite por lote (p.ej. 100) como hoy.
- [ ] **Rama sin hijos**: si la rama Sí o No está vacía, la inscripción termina `completed` sin error.
- [ ] **Desactivar/borrar con inscripciones vivas**: pasar la automatización a `draft` debe pausar (no ejecutar) las inscripciones activas; borrar un nodo con inscripciones apuntándole → `current_node_id` es `on delete set null`: el motor debe tratar puntero null como "seguir al siguiente/terminar" sin crash.
- [ ] **Diff de tags para `tag_added`**: disparar solo con etiquetas NUEVAS (comparar array antes/después en `updateContact`), no en cada guardado.
- [ ] **Actions**: anotar retornos `Promise<{ success?: boolean; error?: string }>` explícitos (gotcha TS del proyecto) y validar TODO input con Zod.
- [ ] **Tony no es técnico**: textos del builder en lenguaje de negocio ("Cuándo empieza", "Hizo click / No hizo click"), nunca jerga (nodes, triggers, enrollments).

## Anti-Patrones

- NO usar react-flow/xyflow ni canvas 2D libre: el builder es vertical con Tailwind (GHL-style).
- NO pre-programar todos los emails al inscribir (rompe las ramas): ejecución por puntero.
- NO merge de ramas en V1: cada rama termina por su lado.
- NO tracking por-link ni píxel de apertura en V1: un token por email enviado, click = click.
- NO editor WYSIWYG/HTML de emails en V1: texto plano + shell() como hoy.
- NO tocar el circuito de emails de reservas (`booking-emails.ts`) ni refactorizar `calendars.ts`/`contacts.ts` más allá de insertar la llamada `fireTrigger`.
- NO inventar cliente de email nuevo: reusar `src/lib/email/client.ts` y `processDueEmails`.
- NO usar `any` (usar `unknown`); NO hardcodear `CRON_SECRET` ni URLs.

---

## Resultado (2026-07-01)
Implementado y verificado E2E: 3 triggers (form/reserva/etiqueta) inscriben; builder vertical construye
trigger+email+rama con columnas Sí/No; click en /r/[token] → redirect validado (anti open-redirect, token falso=404),
activity email_clicked, rama Sí (tag "clicko"); timeout via cron → rama No (tag "frio"); ambas terminan `completed`.
Emails failed por dominio Resend sin verificar (esperado) y el flujo avanza igual. typecheck + build OK.
Queda de demo: automatización "Nutrición Leads" + form "Captación Web" (en Borrador). Datos de prueba limpiados.
