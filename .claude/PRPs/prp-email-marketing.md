# PRP-007: Email Marketing tipo GHL (diseñador visual + campañas masivas + tracking de clicks)

> **Estado**: COMPLETADO (2026-07-05) — 7 fases implementadas y verificadas E2E en browser con envío
> real (Resend), click de tracking, baja y estadísticas. Datos de prueba limpiados. Todos los
> criterios de éxito cumplidos (typecheck + build OK).
> **Fecha**: 2026-07-05
> **Proyecto**: GHL Titan
> **Referencias visuales**: `referencias/email_mkt/*.png` (módulo Marketing de GHL)
> **Convive con**: PRP-006 (automatizaciones). Las campañas son envíos MASIVOS puntuales;
> las automatizaciones son secuencias por contacto. NO se tocan mutuamente.

---

## Objetivo

Un módulo de **Email Marketing** tipo GoHighLevel: un **diseñador visual de emails por bloques**
(texto, imagen, botón, divisor…), un sistema de **campañas** que se envían a toda la lista o a
segmentos por etiqueta (ahora o programadas, con cola de envío por lotes), y **tracking de clicks
por destinatario** con una pestaña de **Estadísticas** para medir cada campaña.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los emails de la plataforma son texto plano con un envoltorio fijo: no sirven para newsletters/promos con imagen de marca | Diseñador visual por bloques que genera HTML compatible con clientes de correo, con previsualización escritorio/móvil y email de prueba |
| No hay forma de enviar UN email a TODA la lista (o a un segmento): las automatizaciones son 1 contacto → 1 secuencia | Campañas: eliges audiencia (todos / por etiquetas), envías ahora o programas, y una cola envía por lotes de forma segura |
| Sin métricas no se puede saber qué campaña funciona | Tracking de clicks por destinatario + panel de estadísticas (enviados, entregados, clicks, tasas) por campaña |
| Enviar marketing masivo sin opción de baja es ilegal (RGPD) y quema la reputación del dominio | Link de baja obligatorio en el pie + página pública de baja + exclusión automática en futuras campañas |

**Valor de negocio**: es el último gran módulo de GHL ($100/mes) que faltaba: con CRM + agenda +
cursos + automatizaciones + **email marketing medible**, Tony puede operar campañas reales a sus
189+ contactos desde su propia plataforma y cancelar GHL.

## Qué

### Criterios de Éxito
- [ ] **Diseñador visual**: editor por bloques apilados (texto con formato básico, imagen por URL, botón con enlace, divisor, espaciador, cabecera/logo, pie con link de baja obligatorio). Se puede añadir con "+", editar, reordenar y borrar bloques. Previsualización escritorio/móvil. Autoguardado. Botón "Enviarme una prueba" que entrega el email real al admin.
- [ ] **Personalización**: el asunto y los bloques de texto admiten `{{nombre}}` (y variantes básicas) que se sustituyen por los datos de cada contacto al enviar.
- [ ] **Campañas**: pestañas Estadísticas / Campañas / Plantillas en `/marketing` (como GHL). Crear campaña → diseñar → elegir audiencia (todos los contactos con email / filtrar por etiquetas) viendo el **contador real de destinatarios** (excluye sin email y bajas) → "Enviar ahora" o "Programar" (fecha y hora).
- [ ] **Cola de envío**: la campaña materializa sus destinatarios al enviar (no al crear), envía por lotes vía Resend, es **idempotente** (re-ejecutar el cron nunca duplica envíos), registra estado por destinatario (pendiente/enviado/fallido/omitido) y la campaña transita borrador → programada → enviando → enviada.
- [ ] **Tracking de clicks**: los links del email se reescriben a `/r/[token]` (un token por destinatario); el click marca al destinatario, registra `email_clicked` en el timeline del contacto y redirige al destino real (validado contra los links reales del email — sin open redirect).
- [ ] **Baja (unsubscribe)**: link en el pie de cada campaña → página pública de confirmación → el contacto queda dado de baja y se omite en todas las campañas futuras. Visible en la ficha del contacto.
- [ ] **Plantillas**: guardar un diseño como plantilla y crear campañas nuevas desde una plantilla.
- [ ] **Estadísticas**: por campaña: destinatarios, entregados, fallidos, clicks y tasas (% sobre entregados), con barras resumen tipo GHL; detalle de campaña con la lista de destinatarios y quién hizo click.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (crear y diseñar):**
1. Admin entra en **Marketing** (nueva sección del menú) → pestaña Campañas → "Crear campaña".
2. Se abre el diseñador: escribe el nombre y el asunto, añade bloques (logo, texto "Hola {{nombre}}", imagen, botón "Reserva tu sesión" → link a /book/…, divisor, pie con datos + baja).
3. Alterna previsualización escritorio/móvil. Pulsa "Enviarme una prueba" y revisa el email real en su bandeja.

**Happy path (enviar y medir):**
4. Pulsa "Enviar o programar" → elige audiencia: "Etiquetas: cliente" → ve "34 destinatarios" → "Enviar ahora".
5. La campaña pasa a **Enviando**: se crean los 34 destinatarios con su token de tracking y la cola envía por lotes (el primer lote sale al instante; el resto lo remata el cron). Al terminar: **Enviada**.
6. Cada contacto recibe el email con su nombre sustituido; en su timeline aparece el envío.
7. Un contacto pulsa el botón → `/r/[token]` registra el click (primera vez), anota `email_clicked` en su timeline y le redirige a la página de reservas.
8. Admin abre **Estadísticas**: la campaña muestra 34 enviados / 33 entregados / 8 clicks (24%). En el detalle ve quién hizo click.
9. Un contacto pulsa "Darse de baja" en el pie → página pública "Te has dado de baja" → en la siguiente campaña ese contacto aparece como **omitido**.

**Programada:** si eligió fecha/hora, la campaña queda **Programada** y el cron la dispara al vencer (mismo endpoint `/api/cron/process-emails` que ya existe — sigue pendiente que Tony configure el cron; sin él solo funciona "Enviar ahora" para el tramo inmediato).

---

## Contexto

### Referencias
- `referencias/email_mkt/*.png` — capturas GHL: dashboard de estadísticas (barras Entregado/Abierto/Click), pestañas Estadísticas/Campañas/Plantillas, selector de tipo de editor, y builder visual (paleta de elementos, secciones/columnas, panel de capas, preview escritorio/móvil, "Enviar o programar", autoguardado).
- `src/features/automations/services/email-engine.ts` — patrón de envío con Resend + reescritura de links con token (`extractUrls`, `shell`). Las campañas NO reusan `shell()` (es para texto plano) pero SÍ el patrón.
- `src/features/automations/services/engine.ts` — patrón de procesado por lotes idempotente (BATCH, next_run_at).
- `src/app/r/[token]/route.ts` — tracking de clicks existente (anti open-redirect). Se EXTIENDE para reconocer también tokens de campaña.
- `src/app/api/cron/process-emails/route.ts` — cron único; se le añade el procesado de campañas.
- `src/actions/automations.ts` — patrón de Server Actions: Zod, `isUniqueViolation`, retornos `Promise<{ success?: boolean; error?: string }>`, revalidatePath.
- `src/features/automations/components/WorkflowBuilder.tsx` — patrón de builder visual sin librerías de canvas (Tailwind + lucide), helper `run()`.
- `src/features/contacts/services/contacts.ts` — filtro por tags (`tags @> $n`) y `getAllTags()` para el selector de audiencia.
- `src/shared/components/sidebar.tsx` — NAV_ITEMS (añadir "Marketing" con icono Mail/Megaphone).
- `src/lib/email/client.ts` — `getResend()`, `EMAIL_FROM`, `EMAIL_ADMIN` (email de prueba).
- `src/lib/db.ts` — `query`/`queryOne`. Migraciones con `node scripts/run-sql.js db/migrations/000X_*.sql`.

### Arquitectura Propuesta (Feature-First)
```
src/features/marketing/
├── components/
│   ├── CampaignList.tsx        # pestaña Campañas (tabla: nombre, estado, destinatarios, clicks)
│   ├── EmailBuilder.tsx        # diseñador: canvas de bloques + paleta "+" + panel de ajustes
│   ├── blocks/                 # editores de cada tipo de bloque (texto, imagen, botón...)
│   ├── SendDialog.tsx          # audiencia (todos/etiquetas + contador) + ahora/programar
│   ├── StatsView.tsx           # pestaña Estadísticas (barras resumen + tabla por campaña)
│   └── TemplateList.tsx        # pestaña Plantillas
├── services/
│   ├── render.ts               # bloques JSON → HTML email-safe (tablas + estilos inline, 600px)
│   ├── campaign-engine.ts      # materializar destinatarios + enviar por lotes + estados
│   └── queries.ts              # lecturas para páginas (campañas, stats, plantillas)
src/actions/marketing.ts        # Server Actions (CRUD campaña/plantilla, guardar diseño, enviar, prueba)
src/app/(main)/marketing/
├── page.tsx                    # pestañas Estadísticas / Campañas / Plantillas
└── campaigns/[id]/page.tsx     # diseñador de la campaña
src/app/unsubscribe/[token]/    # página pública de baja
src/app/r/[token]/route.ts      # (existente) + lookup de tokens de campaña
```

**Decisiones clave:**
- **Tablas propias para campañas** (no reusar `scheduled_emails`): esa tabla es la bandeja de las automatizaciones (automation_id NOT NULL, cuerpo texto plano por fila). Una campaña guarda el diseño UNA vez y los destinatarios son filas ligeras con token/estado. El cron y `/r/[token]` se comparten.
- **Editor por bloques en UNA columna** (V1): cubre el 95% de los emails reales (max-width 600px). Sin secciones multi-columna ni drag libre estilo GHL — se añade "+" entre bloques y reorden con flechas, como el patrón WorkflowBuilder. Nada de librerías externas de editor.
- **El diseño se guarda como JSON** (array de bloques) y se **renderiza a HTML email-safe al enviar** (tablas, estilos inline). Al enviar se congela un snapshot del HTML y de sus links en la campaña: editar después no altera lo enviado ni rompe la validación de redirects.
- **Solo clicks en V1** (lo pedido). Sin píxel de apertura: las "aperturas" son poco fiables (Apple Mail las infla) y GHL las muestra pero no las necesitamos para medir campañas. Se puede añadir después.
- **Imagen por URL** en V1: el proyecto no tiene almacenamiento de ficheros (Neon es solo BD). El bloque imagen acepta una URL pública.

### Modelo de Datos (migración `db/migrations/0003_email_marketing.sql`)
```sql
-- Plantillas reutilizables (diseño = bloques JSON)
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  design jsonb not null default '[]',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Campañas
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  design jsonb not null default '[]',      -- bloques del editor
  html_snapshot text,                      -- HTML congelado al enviar
  link_urls text[] default '{}',           -- links del snapshot (validación anti open-redirect)
  status text not null default 'draft',    -- 'draft' | 'scheduled' | 'sending' | 'sent'
  audience jsonb not null default '{"type":"all"}',  -- {type:'all'} | {type:'tags', tags:[...]}
  scheduled_at timestamptz,                -- si programada
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index on email_campaigns (status, scheduled_at);

-- Destinatarios: cola + tracking por contacto
create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  to_email text not null,
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed' | 'skipped'
  sent_at timestamptz,
  error text,
  click_token text unique not null,        -- token de tracking (por destinatario)
  clicked_at timestamptz,
  created_at timestamptz default now() not null,
  unique (campaign_id, contact_id)         -- idempotencia: jamás dos envíos al mismo contacto
);
create index on campaign_recipients (campaign_id, status);
create index on campaign_recipients (click_token);
create index on campaign_recipients (contact_id);

-- Bajas de marketing (a nivel contacto)
alter table contacts
  add column unsubscribed_at timestamptz,
  add column unsubscribe_token text unique default encode(gen_random_bytes(16), 'hex');
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo FASES. Las subtareas se generan al entrar a cada fase
> con el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Base de datos + tipos + navegación
**Objetivo**: Migración 0003 aplicada en Neon (plantillas, campañas, destinatarios, bajas en contacts), tipos en `src/types/database.ts`, entrada "Marketing" en el sidebar y página `/marketing` con las 3 pestañas (vacías).
**Validación**: `node scripts/run-sql.js` OK; `scripts/query.js` muestra las tablas; typecheck pasa; la página carga con las pestañas.

### Fase 2: Diseñador visual de emails
**Objetivo**: `EmailBuilder` funcional en `/marketing/campaigns/[id]`: bloques (texto, imagen, botón, divisor, espaciador, cabecera, pie con baja), añadir/editar/reordenar/borrar, ajustes por bloque, preview escritorio/móvil, autoguardado del JSON, render email-safe (`render.ts`) y "Enviarme una prueba" al email del admin.
**Validación**: diseñar un email completo en el browser, recargar sin perder nada, y recibir la prueba real por Resend con el HTML renderizado.

### Fase 3: Audiencia y envío/programación
**Objetivo**: `SendDialog`: elegir todos/etiquetas con contador real de destinatarios (excluye sin email y bajas), "Enviar ahora" o "Programar fecha/hora". Al confirmar: snapshot de HTML+links, materialización de `campaign_recipients` y transición de estado (draft → sending/scheduled).
**Validación**: con datos de prueba, confirmar que el contador cuadra con la BD y que los destinatarios se crean una sola vez aunque se reintente.

### Fase 4: Motor de envío + tracking de clicks + baja
**Objetivo**: `campaign-engine.ts` envía pendientes por lotes (personalización `{{nombre}}`, links reescritos a `/r/[token]`, estados por destinatario, campaña → sent al agotar pendientes), enganchado al cron existente y con tramo inmediato inline en "Enviar ahora". `/r/[token]` reconoce tokens de campaña (click + timeline + redirect validado). Página pública `/unsubscribe/[token]` + pie con link de baja + omisión de bajas.
**Validación**: E2E real con el email del admin: recibir campaña → click → timeline + contador; darse de baja → siguiente campaña lo marca "omitido". Re-ejecutar el cron no duplica nada.

### Fase 5: Plantillas
**Objetivo**: pestaña Plantillas: guardar el diseño de una campaña como plantilla, listar, y crear campaña nueva desde plantilla (o en blanco).
**Validación**: ciclo completo guardar → crear desde plantilla → el diseño aparece clonado.

### Fase 6: Estadísticas
**Objetivo**: pestaña Estadísticas tipo GHL: barras resumen (destinatarios → entregados → clicks con % acumulado), selector de campaña, y tabla por campaña (enviados, entregados, fallidos, clicks, tasa). Detalle de campaña con lista de destinatarios y su estado/click.
**Validación**: los números de la UI cuadran exactamente con `scripts/query.js` sobre `campaign_recipients`.

### Fase 7: Validación Final
**Objetivo**: Sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: recorrido E2E (crear → diseñar → prueba → enviar → click → baja → estadísticas)
- [ ] Datos de prueba limpiados (preferencia de Tony)
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-07-05: los modificadores de opacidad de Tailwind no funcionan con los colores del design system
- **Error**: `bg-primary/40` no pinta nada: los colores están definidos como `var(--primary)` en
  tailwind.config.ts (sin `<alpha-value>`), así que Tailwind no puede aplicar opacidad y omite la clase.
- **Fix**: usar `bg-primary` + `style={{ opacity }}` inline (o definir el color con alpha-value).
- **Aplicar en**: cualquier UI de este proyecto que quiera tintes del color primario.

### 2026-07-05: toda sección nueva del panel DEBE añadirse al proxy
- **Error**: `/marketing` quedó accesible sin login: el proxy protege por lista de prefijos
  (`src/proxy.ts`) y nadie añadió la ruta nueva al crearla en Fase 1.
- **Fix**: añadir `startsWith('/marketing')` a isProtectedRoute. Checklist: crear sección en
  `(main)` = tocar sidebar + proxy SIEMPRE.
- **Aplicar en**: cualquier ruta nueva bajo (main) en este proyecto.

### 2026-07-05: gen_random_bytes necesita pgcrypto en Neon
- **Error**: `function gen_random_bytes(integer) does not exist` al aplicar la migración 0003. En PG moderno `gen_random_uuid()` es built-in pero `gen_random_bytes()` sigue viviendo en la extensión pgcrypto.
- **Fix**: `create extension if not exists pgcrypto;` al inicio de la migración. (run-sql.js ejecuta el fichero como transacción: el fallo no dejó nada a medias.)
- **Aplicar en**: cualquier migración que genere tokens con gen_random_bytes.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **Neon, no Supabase**: todo con `query`/`queryOne` de `src/lib/db.ts`; migraciones con `node scripts/run-sql.js`; nada de RLS/supabase-js.
- [ ] **Límites de Resend (avisar a Tony en lenguaje de negocio)**: el plan gratuito permite ~100 emails/día y 2 peticiones/segundo → una campaña a los 189 contactos NO cabe en el plan free. El motor debe enviar por lotes con ritmo (batch API de Resend admite hasta 100 emails por llamada) y dejar los fallidos marcados, no reventar. Además el **dominio sigue sin verificar** (pendiente de Tony): los envíos a terceros fallarán hasta entonces; probar E2E con el email del admin.
- [ ] **HTML de email ≠ HTML web**: `render.ts` debe generar tablas + estilos inline, max-width 600px, sin flexbox/grid/clases Tailwind; imágenes con width fijo y alt. Probar la prueba real en Gmail (es el cliente de Tony).
- [ ] **Snapshot al enviar**: congelar `html_snapshot` + `link_urls` en la campaña ANTES de crear destinatarios. La validación del redirect en `/r/[token]` usa el snapshot, no el diseño vivo (que puede editarse después).
- [ ] **Anti open-redirect**: mismo criterio que PRP-006 — `u` debe estar en `link_urls` del snapshot; token inexistente → 404; sin `u` válido → primer link del snapshot.
- [ ] **Idempotencia de la cola**: `unique (campaign_id, contact_id)` + procesar solo `status='pending'`; marcar sent/failed fila a fila. Re-ejecutar el cron o pulsar dos veces "Enviar" no debe duplicar emails. Cerrar la campaña (sent) solo cuando no queden pendientes.
- [ ] **Cron sigue sin configurar** (pendiente de Tony): "Enviar ahora" debe procesar un tramo inline (como hace `submitPublicForm`) para que las campañas pequeñas salgan sin cron; las programadas y las colas largas lo necesitan — mantener el aviso en la UI.
- [ ] **`NEXT_PUBLIC_SITE_URL` en links de tracking y baja**: en dev desde la LAN debe ser `http://192.168.1.20:3000` o los links del email no funcionarán desde otra máquina.
- [ ] **`{{nombre}}` sin datos**: sustituir con fallback vacío y colapsar espacios ("Hola ," NO puede llegar a un cliente). Definir merge tags mínimos: nombre, apellido, email.
- [ ] **Bajas y sin-email se excluyen en DOS puntos**: en el contador del SendDialog y en la materialización de destinatarios (por si la lista cambia entre medias, los ya materializados con baja → 'skipped' al procesar).
- [ ] **Token de baja para contactos existentes**: el `default` de la columna solo aplica a filas nuevas → la migración debe rellenar `unsubscribe_token` en los 189 contactos existentes (UPDATE + luego NOT NULL si se quiere).
- [ ] **Actions**: retorno explícito `Promise<{ success?: boolean; error?: string }>` (gotcha TS del proyecto), Zod en TODO input, `isUniqueViolation` para 23505.
- [ ] **Autoguardado del diseñador**: guardar con debounce/onBlur (patrón rename de WorkflowBuilder), nunca en cada tecla; el diseño puede pesar — validar tamaño máximo del JSON con Zod.
- [ ] **Archivos < 500 líneas**: el diseñador se parte en `EmailBuilder` + `blocks/*` + panel de ajustes desde el principio.
- [ ] **Tony no es técnico**: textos en lenguaje de negocio ("Destinatarios", "Darse de baja", "Enviar o programar"), estados en español (Borrador/Programada/Enviando/Enviada), avisos claros (límite del plan de email, dominio sin verificar, cron pendiente).

## Anti-Patrones

- NO usar librerías externas de editor de emails ni drag&drop (grapesjs, unlayer, react-email, dnd-kit): bloques con Tailwind + "+" + flechas, patrón WorkflowBuilder.
- NO secciones multi-columna ni panel de capas en V1 (GHL las tiene; aquí una columna de bloques).
- NO píxel de apertura en V1: solo clicks (lo pedido; las aperturas son métricas infladas).
- NO subir/almacenar imágenes en V1: el bloque imagen usa URL pública.
- NO tocar el motor de automatizaciones (`engine.ts`, `scheduled_emails`, `email-engine.ts`) más allá de compartir cron y ruta `/r/[token]`.
- NO reusar `shell()` de automatizaciones para campañas: render propio email-safe.
- NO pre-crear destinatarios al crear la campaña (solo al enviar: la audiencia se congela en ese momento).
- NO enviar a contactos sin email o dados de baja, nunca.
- NO usar `any` (usar `unknown`); NO hardcodear `CRON_SECRET` ni URLs.

---

*PRP pendiente aprobación. No se ha modificado código.*
