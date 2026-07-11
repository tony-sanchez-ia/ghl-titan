# PRP-011: Editor de Formularios (Form Builder tipo GHL)

> **Estado**: COMPLETADO
> **Fecha**: 2026-07-10
> **Proyecto**: GHL Titan
> **Apartado**: Web (nuevo grupo del menú: Embudos + Formularios)
> **Nota de numeración**: renumerado de PRP-010 a **PRP-011** (el 010 lo tenía asignado el PRP de
> Outlook free/busy del otro agente). Migración de BD: `0006_form_builder.sql` (aplicada).

---

## Objetivo

Un **editor visual de formularios** tipo GoHighLevel: el admin construye formularios arrastrando campos, ajusta estilos en una barra lateral, define qué pasa al enviarse (mensaje de gracias o redirección + etiquetas/automatización) y obtiene **código de integración** para pegarlo en cualquier web (iframe inline auto-ajustable o popup emergente) o compartir su **enlace público** directo. Cada envío **crea/actualiza automáticamente el contacto en el CRM** (captación de leads), y el formulario mide **vistas, envíos y conversión**.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los formularios actuales son fijos (nombre/email/teléfono/mensaje), sin diseño ni campos configurables. | Editor visual con campos tipados, estilos y comportamiento al enviar. |
| No se pueden incrustar en webs externas ni en las páginas de funnels con campos a medida. | Código de integración (iframe/popup) + enlace público + reutilizable como bloque de funnel/email. |
| No hay forma de saber cuánta gente ve o rellena un formulario. | Medición de vistas, envíos y % de conversión por formulario. |
| Captar leads desde una web externa hoy requiere pegar datos a mano. | Cada envío entra directo al CRM como contacto, con etiquetas y automatización opcionales. |

**Valor de negocio**: replica una de las funciones estrella de GHL (form builder), cierra el bucle de captación → CRM → automatización sin herramientas externas, y aporta la métrica de conversión que hoy falta. Refuerza el objetivo raíz: cancelar la suscripción de GHL.

## Qué

### Criterios de Éxito
- [ ] Puedo crear un formulario, añadir/reordenar campos tipados (texto, email, teléfono, área de texto, número, fecha, desplegable, opción única, selección múltiple, casilla de consentimiento, título/párrafo estático, campo oculto) y ponerlos a **ancho completo o media columna**.
- [ ] Una **barra lateral de estilos** cambia en vivo: colores (fondo, texto, botón, borde), radio y grosor de borde, ancho del formulario, alineación de etiquetas, tema; con vista previa escritorio/móvil.
- [ ] En **"Al enviar"** elijo: mostrar un **mensaje de gracias con formato** o **redirigir a una URL**; y opcionalmente **añadir etiquetas** al contacto e **inscribirlo en una automatización**.
- [ ] Obtengo **código de integración** copiable: `<iframe>` inline (auto-alto), **snippet de popup emergente** con disparador (al hacer clic / a los X segundos / al desplazarse X%), y el **enlace público** directo `/form/[slug]`.
- [ ] Al enviarse el formulario (desde el enlace, el iframe o la página de un funnel) se **crea o actualiza el contacto** en el CRM (dedup por email), se registra la actividad en su timeline, se aplican etiquetas y se dispara la automatización vinculada.
- [ ] La pestaña **Envíos** lista las respuestas recibidas (todos los campos), y **Análisis** muestra vistas, envíos y conversión (con filtro de últimos N días).
- [ ] El formulario vive en el **apartado Web** del menú (junto a Embudos). Los formularios existentes siguen funcionando como disparadores de automatización y como bloque de funnel/email sin romperse.
- [ ] `npm run typecheck` y `npm run build` pasan; verificado E2E en navegador y datos de prueba limpiados.

### Comportamiento Esperado (Happy Path)
1. Admin entra en **Web → Formularios → Nuevo**, le da nombre ("Captación Web").
2. En el **editor** añade campos desde la paleta (Nombre, Email\*, Teléfono, un desplegable "¿Cómo te contactamos?"), los reordena y pone Nombre+Teléfono en dos columnas.
3. En **Estilos** elige color de botón azul de marca, radio 8px, ancho 640px; alterna vista móvil para comprobar el apilado.
4. En **Al enviar** escribe "¡Gracias! Te contactamos pronto." y marca la etiqueta `lead-web` + la automatización "Nutrición Leads".
5. Pulsa **Publicar**. En **Integrar** copia el snippet de popup y lo pega en su web externa; también copia el enlace directo.
6. Un visitante abre la web, sale el popup, rellena y envía → ve el mensaje de gracias. En GHL Titan aparece un **contacto nuevo** con la etiqueta, su timeline con `form_submitted`, queda inscrito en la automatización y el envío se ve en **Envíos**.
7. En **Análisis** el formulario marca 1 vista y 1 envío (100% conversión de ese visitante).

---

## Contexto

### Referencias (código existente a reutilizar — NO reinventar)
- **Sistema de formularios actual** (a extender, no sustituir su tabla):
  - `db/migrations/0001_init.sql` → tabla `forms` (id, slug, name, description). **Referenciada por 3 sitios**: `automation_trigger_defs.config.form_id` (trigger `form_submitted`), bloque `form` del editor de emails (`EmailBlockConfig.form_id`) y bloque `form` de funnels (`PageBlockConfig.form_id`/`form_slug`). → **Extender la tabla, no crear otra**, para no romper nada.
  - `src/actions/automations.ts` → `submitPublicForm()`: patrón de **dedup de contacto por email + activity + `fireTrigger('form_submitted')` + `processDueEmails()`**. Es la base del nuevo motor de envío (generalizado a campos dinámicos).
  - `src/features/automations/components/PublicForm.tsx` y `FormEditor.tsx`: formulario público y editor **básicos** actuales (se sustituyen por los nuevos, ricos).
  - `src/features/funnels/components/EmbeddedFunnelForm.tsx`: cómo un funnel ya incrusta el form (llama a `submitPublicForm` + `/api/track`). Debe seguir funcionando.
- **Editor visual (patrón de UX a espejar)**:
  - `src/features/funnels/components/PageBuilder.tsx` / `PageCanvas.tsx` / `PageBlockSettings.tsx`: editor de 3 zonas (paleta / lienzo / ajustes) con reordenar, preview escritorio/móvil y panel lateral de estilos. El Form Builder replica esta estructura con un modelo propio de **lista de campos** (no secciones libres).
  - `src/features/funnels/components/page-render.tsx` (`PageView`/`PageBlockView`): **render puro compartido editor↔público**. El Form Builder tendrá su `form-render.tsx` equivalente.
  - `src/features/funnels/services/design.ts` + `src/shared/lib/section-layout.ts`: patrón `version/styles/…`, migración perezosa desde BD y helpers de layout.
- **Tracking**:
  - `db/migrations/0004_funnels.sql` (`funnel_events`) + `src/features/funnels/services/tracking.ts` (`recordPageView` con **dedupe por visitante+día**) + `src/app/api/track/route.ts` + `src/features/funnels/components/FunnelTracker.tsx`. El form tendrá su equivalente **independiente del funnel** (los forms se incrustan en cualquier web, no dependen de la cookie `tv_id` del proxy).
- **Piezas compartidas listas para usar**:
  - `src/shared/lib/sanitize.ts` (saneado de HTML del mensaje de gracias / bloques), `src/shared/components/rich-text-input.tsx` (editor de texto con formato), `src/shared/lib/uid.ts` (`uid()` — **nunca `crypto.randomUUID` en cliente**, gotcha LAN), `src/shared/lib/ui.ts` (tokens `ui.card/input/button…`), `slugify()` (en `actions/automations.ts`).
- **Infra**:
  - `src/proxy.ts`: `RESERVED_SEGMENTS` ya incluye `form`; `/form` es público (no protegido). Habrá que añadir `/forms` (panel, protegido) a rutas protegidas y a `RESERVED_SEGMENTS`.
  - `src/lib/db.ts`: `query<T>()` / `queryOne<T>()` (pg parametrizado, sin ORM).
  - `src/shared/components/sidebar.tsx`: menú plano actual → introducir grupo "Web".
  - Gotcha deploy (memoria): `NEXT_PUBLIC_*` van como **Build Args**; nuevas rutas de `(main)` hay que añadirlas al `proxy.ts`.

### Arquitectura Propuesta (Feature-First)
```
src/features/forms/
├── components/
│   ├── FormList.tsx              # listado (Web → Formularios)
│   ├── FormBuilder.tsx           # editor 3 zonas (paleta / lienzo / ajustes) + tabs
│   ├── FieldPalette.tsx          # paleta de campos (izquierda)
│   ├── FormCanvas.tsx            # lienzo con reordenar + ancho columna + selección
│   ├── FieldSettings.tsx         # ajustes del campo seleccionado
│   ├── FormStylePanel.tsx        # barra lateral de estilos + temas
│   ├── SubmitBehaviorPanel.tsx   # "Al enviar": mensaje/redirect + etiquetas/automatización
│   ├── IntegrateDialog.tsx       # modal Integrar: iframe / popup / enlace (copiar)
│   ├── PublicFormRenderer.tsx    # cliente: render público real + envío + tracking
│   ├── SubmissionsTable.tsx      # pestaña Envíos
│   ├── FormAnalytics.tsx         # pestaña Análisis
│   └── form-render.tsx           # render PURO compartido editor↔público (campos+estilos)
├── services/
│   ├── schema.ts                 # FormSchema: defaults, migración BD, helpers, tipos de campo
│   ├── queries.ts                # lecturas (form, submissions, stats)
│   ├── tracking.ts               # recordFormView (dedupe día) + stats
│   └── validation.ts             # Zod dinámico a partir del schema del form (server)
└── (types en src/types/database.ts)

src/actions/forms.ts              # createForm/updateForm(schema,styles,settings)/publish/delete/submit
src/app/(main)/forms/            # panel: listado, /new, /[id] (editor con tabs)
src/app/form/[slug]/             # público (upgrade del actual) + modo ?embed=1
src/app/api/forms/track/         # beacon de vistas (POST)
public/forms/embed.js            # loader para iframe inline (auto-alto) + popup
```

### Modelo de Datos (migración `db/migrations/0006_form_builder.sql`)
```sql
-- 1) Extender forms (conserva id/slug → automatizaciones, funnels y emails siguen apuntando aquí)
alter table forms
  add column status  text  not null default 'draft',   -- 'draft' | 'published'
  add column schema  jsonb not null default '{}',       -- FormSchema {version, fields[]}
  add column styles  jsonb not null default '{}',       -- FormStyles {colors, border, width, labels…}
  add column settings jsonb not null default '{}';      -- FormSettings {submit, redirect_url, message_html, add_tags[], automation_id}

-- Backfill: el/los form(es) existentes reciben el schema clásico (name/email/phone/message)
-- y quedan 'published' para no romper enlaces vivos. (SQL con el JSON por defecto.)
update forms set status = 'published', schema = '{...clásico...}'::jsonb where schema = '{}'::jsonb;

-- 2) Envíos crudos (todos los campos, incluidos los que no mapean a contacto)
create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  data jsonb not null default '{}',        -- { field_key: value }
  visitor_id text,                          -- para conversión por visitante único
  created_at timestamptz default now() not null
);
create index on form_submissions (form_id, created_at desc);

-- 3) Eventos de medición (independientes del funnel). V1 registra 'view'.
create table form_events (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  visitor_id text not null,
  type text not null default 'view',        -- 'view' (extensible)
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);
create index on form_events (form_id, type, created_at);
create index on form_events (form_id, visitor_id, type, created_at);
```
> **Sin RLS** (arquitectura Neon: todo acceso server-side, admin único). Migración vía `node scripts/run-sql.js db/migrations/0006_form_builder.sql`.

### Modelo de dominio (tipos en `src/types/database.ts`)
- `FieldType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'radio' | 'checkbox_group' | 'consent' | 'heading' | 'paragraph' | 'hidden'`.
- `FormField { id, type, key, label, placeholder?, required?, width: 'full'|'half', options?: {label,value}[], help?, content_html? (heading/paragraph), default? }`.
  - **`key` reservadas** que mapean a columnas de `contacts`: `first_name`, `last_name`, `email`, `phone`, `business_name`. `email` es obligatorio para el dedup (igual que hoy). El resto se guardan en `form_submissions.data` + `contact_activities.metadata`.
- `FormStyles { background_color, text_color, button_color, button_text_color, border_color, border_width, border_radius, width, label_align, theme }` (subconjunto sensato de GHL; ampliable).
- `FormSettings { submit_action: 'message'|'redirect', message_html?, redirect_url?, submit_label, add_tags: string[], automation_id?: string }`.
- `FormSchema { version: 1, fields: FormField[] }` con `migrateFormSchema()` perezoso (patrón `migratePageDesign`).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar en cada fase (bucle agéntico: mapear contexto real → subtareas → ejecutar → auto-blindaje).

### Fase 1: Modelo de datos y dominio
**Objetivo**: migración `0006` (extender `forms` + `form_submissions` + `form_events` + backfill), tipos en `database.ts`, `services/schema.ts` (defaults/migración/campos reservados) y `services/queries.ts` de lectura.
**Validación**: migración aplicada sin error; `queryOne` devuelve el form con `schema/styles/settings`; el form demo existente queda con schema clásico y `published`; `npm run typecheck` pasa.

### Fase 2: Motor de envío + captación al CRM + tracking
**Objetivo**: `actions/forms.ts::submitForm()` generalizado — valida contra el schema con **Zod dinámico** (`services/validation.ts`), dedup/crea contacto mapeando campos reservados, guarda `form_submissions`, registra activity `form_submitted`, aplica `add_tags`, dispara automatización (`fireTrigger('form_submitted', {formId})` + `processDueEmails()`). `services/tracking.ts::recordFormView()` (dedupe visitante+día) y `api/forms/track` (beacon). El envío devuelve la acción resultante (mensaje/redirect).
**Validación**: prueba server (script `query.js`/Playwright) — un envío crea contacto con tags, submission y activity; `recordFormView` no duplica en el mismo día; automatización se inscribe. Reutiliza el patrón exacto de `submitPublicForm`.

### Fase 3: Editor visual (paleta + lienzo + estilos + "al enviar")
**Objetivo**: `FormBuilder` con tabs (Editar / Estilos / Al enviar / Integrar / Envíos / Análisis) espejando `PageBuilder`: `FieldPalette` (añadir), `FormCanvas` (reordenar, ancho columna, seleccionar), `FieldSettings`, `FormStylePanel` (colores/borde/ancho/etiquetas + 2-3 temas, en vivo), `SubmitBehaviorPanel` (mensaje con `RichTextInput` saneado / redirect + selector de etiquetas y automatización), toggle escritorio/móvil. Server actions de guardado (schema/styles/settings, publicar/despublicar, slug). `form-render.tsx` puro compartido.
**Validación**: crear form, añadir/reordenar campos, 2 columnas, cambiar colores en vivo, escribir mensaje de gracias, guardar y publicar; recargar mantiene el estado; `typecheck` pasa. Gotchas de `contentEditable`/toolbar de PRP-008 aplicados si se reusa el rich text.

### Fase 4: Página pública + incrustación
**Objetivo**: upgrade de `app/form/[slug]/page.tsx` para renderizar el schema con estilos (SSR + `PublicFormRenderer` cliente para envío y beacon de vista). Modo `?embed=1` (sin chrome, fondo transparente, auto-post de alto por `postMessage`). `public/forms/embed.js`: inyecta iframe **inline** con auto-alto y modo **popup** con disparador (clic / X s / scroll %). `IntegrateDialog` con los 3 snippets copiables (iframe, popup, enlace directo). Contexto de tracking pasado al render.
**Validación**: `/form/[slug]` responde y crea contacto real; iframe embebido en una página de prueba se auto-ajusta de alto y envía; popup abre con el disparador; enlace directo funciona. Gotcha: sin `X-Frame-Options`/CSP que bloquee el iframe.

### Fase 5: Envíos y Análisis
**Objetivo**: `SubmissionsTable` (pestaña Envíos: lista con todos los campos, fecha, contacto enlazado) y `FormAnalytics` (pestaña Análisis: vistas, envíos, % conversión por visitante único, filtro N días) con queries `filter (where …)` estilo `getFunnelStats`. La ficha de contacto ya muestra `form_submitted` en el timeline (sin cambios).
**Validación**: tras un envío de prueba, Envíos muestra 1 fila con los datos y Análisis 1 vista/1 envío/100%.

### Fase 6: Navegación "Web" + integración con lo existente
**Objetivo**: `sidebar.tsx` → grupo **"Web"** que agrupa **Embudos** + **Formularios** (encabezado de grupo, patrón mínimo). Rutas `app/(main)/forms/*`. `proxy.ts`: `/forms` protegido + `RESERVED_SEGMENTS` += `forms`. Migrar/redirigir el CRUD viejo `/automations/forms` → `/forms` (redirect + retirar `FormEditor`/`PublicForm` viejos y sus rutas). Verificar que el **selector de formularios como disparador** en Automatizaciones y el **bloque `form`** de funnels/emails siguen funcionando (mismo `forms.id`). Actualizar `EmbeddedFunnelForm`/bloque form para, opcionalmente, renderizar el schema real (mínimo: seguir funcionando con el flujo actual).
**Validación**: menú muestra grupo Web; `/forms` protegido redirige a login sin sesión; crear automatización con trigger de form sigue OK; bloque form en un funnel envía y crea contacto; sin rutas huérfanas ni imports muertos (limpiar los que dejen mis cambios).

### Fase 7: Validación Final
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso (validar con `next start`, el dev server muere por OOM en la máquina compartida — gotcha memoria)
- [ ] Playwright E2E: crear form → estilar → publicar → integrar → enviar **desde el iframe** → contacto creado en CRM con etiqueta + timeline + inscrito en automatización → Envíos y Análisis reflejan el envío
- [ ] Datos de prueba limpiados (contactos/submissions/eventos de test)
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación. El mismo error nunca ocurre dos veces.

### 2026-07-10: El loader de incrustación NO puede vivir bajo una ruta protegida
- **Error**: puse `embed.js` en `public/forms/embed.js` → servido en `/forms/embed.js`. Pero al proteger
  `/forms` en el proxy, el `<script>` de webs externas (visitante sin sesión) recibía un redirect 302 a
  `/login` en vez del JS → la incrustación no cargaba en ningún sitio externo.
- **Fix**: mover el loader a la RAÍZ pública: `public/titan-forms.js` (`/titan-forms.js`). El matcher del
  proxy no excluye `.js`, así que igual pasa por el middleware, pero al no empezar por `/forms` no se
  protege. Verificado: 200 desde origen cross-origin.
- **Aplicar en**: cualquier asset estático (js/css/widget) pensado para incrustarse en terceros — nunca
  bajo un prefijo de ruta protegido por el proxy.

### 2026-07-10: Medición de forms embebidos sin depender de la cookie del proxy
- **Contexto**: los forms se incrustan en iframes de dominios ajenos → la cookie `tv_id` que pone el
  proxy (solo en `/p/…`) no aplica y las cookies de 3rd-party suelen estar bloqueadas.
- **Solución**: visitor id propio en `localStorage` (`titan_vid`), primer-party dentro del iframe (mismo
  origen que nuestra app). Beacon a `/api/forms/track` en el montaje; dedupe de vista por visitante+día.
  Degrada a id efímero si `localStorage` está bloqueado (la medición nunca rompe el formulario).
- **Aplicar en**: cualquier widget incrustable que necesite medir sin cookies de terceros.

### 2026-07-10: Coordinación de numeración entre agentes en paralelo
- **Error**: otro agente había reservado `PRP-010` y la migración `0006` para Outlook free/busy (en
  espera). Yo usé los mismos → colisión de nº de PRP y de migración.
- **Fix**: mi migración `0006` ya estaba aplicada a Neon (no se puede renumerar sin lío), así que
  renumeré MI PRP a `011` y la migración PLANEADA de Outlook a `0007`. Documentado en MEMORY.md.
- **Aplicar en**: con varios agentes sobre el mismo repo, comprobar `git status` + MEMORY.md ANTES de
  elegir nº de PRP/migración; el número de una migración YA aplicada manda (renumera el que no ha corrido).

---

## Gotchas

- [ ] **Extender `forms`, no crear tabla nueva**: `forms.id` lo referencian automatizaciones (trigger), funnels y emails (bloque form). Cambiar de tabla rompería los 3. La migración hace backfill del schema clásico al form existente.
- [ ] **`email` sigue siendo obligatorio** para el dedup de contacto (patrón `submitPublicForm`). El validador Zod dinámico debe forzarlo aunque el admin no lo marque required (o impedir publicar sin campo email).
- [ ] **Tracking independiente del funnel**: los forms se incrustan en webs externas → no hay cookie `tv_id` del proxy. Usar **visitor id propio en `localStorage`** (primer-party dentro del iframe, mismo origen que nuestro dominio); degradar sin romper si está bloqueado. Dedupe de vista por visitante+form+**día** (patrón `recordPageView`).
- [ ] **Iframe embebible**: Next no pone `X-Frame-Options` por defecto (bien), pero NO añadir CSP `frame-ancestors` que lo bloquee. Auto-alto vía `postMessage` desde `?embed=1`.
- [ ] **`uid()` y no `crypto.randomUUID` en cliente** (gotcha LAN `http://IP`): usar el helper `src/shared/lib/uid.ts` en el editor. Igual para `navigator.clipboard` en el copiado (contexto no seguro): fallback.
- [ ] **Saneado de HTML**: el mensaje de gracias y cualquier bloque HTML pasan por `src/shared/lib/sanitize.ts` **al guardar** (no confiar en el cliente). Reusar gotchas de `contentEditable`/toolbar de PRP-008 (barras estáticas, `preventDefault` en `mousedown`).
- [ ] **Rutas nuevas al `proxy.ts`**: `/forms` protegido + reservado; `/form` y `/api/forms/*` públicos. Sin esto, o se filtra el panel o se bloquea el público.
- [ ] **`add_tag` y bucles de automatización**: aplicar etiquetas del form NO debe re-disparar triggers `tag_added` en cascada (anti-bucle ya contemplado en el motor; no reintroducirlo).
- [ ] **Anti open-redirect** en `redirect_url` de "al enviar": validar destino (URL absoluta http/https) antes de redirigir, patrón de los links reescritos de automatizaciones.
- [ ] **Deploy**: `NEXT_PUBLIC_*` como Build Args; `embed.js` servido estático desde `/public` con la URL absoluta del formulario (usar `NEXT_PUBLIC_SITE_URL`).

## Anti-Patrones
- NO crear una tabla `forms` paralela ni un modelo de secciones libres: los formularios son **lista de campos tipados** (más simple y correcto que copiar `PageDesign`).
- NO duplicar el motor de captación: reutilizar el patrón `submitPublicForm` (dedup + activity + trigger).
- NO condiciones avanzadas (mostrar/ocultar campos, descalificar) en V1 → **fase 2** (decisión de producto tomada).
- NO pagos ni "campos de objeto" de GHL en V1 (fuera de alcance).
- NO `any` (usar `unknown` + Zod), NO ignorar errores de TypeScript, NO hardcodear tokens de color (usar `styles`).

---

## Fuera de alcance (fase 2 / futuro)
- Lógica condicional "si…": mostrar/ocultar campos según respuestas y descalificar leads.
- Modo de incrustación **barra lateral deslizante** (V1 hace iframe inline + popup).
- Pagos (vender producto / cobrar) y campos de objeto/CRM avanzados.
- Notificaciones por email al admin al recibir un envío (se puede añadir reutilizando `booking-emails`).
- Subida de archivos y reCAPTCHA/anti-spam avanzado.

---

*PRP pendiente de aprobación. No se ha modificado código.*
