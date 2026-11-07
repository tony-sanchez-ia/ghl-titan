# PRP-019: Inicio estilo Brevo + Agenda activable + importador Brevo + aperturas

> **Estado**: COMPLETADO (2026-11-07)
> **Fecha**: 2026-11-07
> **Proyecto**: GHL Titan

---

## Objetivo

Que instancias de newsletter/marketing como robotrock.live tengan: (1) un **Inicio** centrado en
campañas y contactos (saludo, calendario de envíos, últimas campañas con aperturas/clicks, resumen
de contactos), (2) la **Agenda** como módulo apagable con interruptores visuales en Ajustes,
(3) la **Salud del sistema** movida a Ajustes, (4) **medición de aperturas** en los emails, y
(5) un **importador del export de Brevo** con etiqueta común y bajas respetadas.

## Por Qué

| Problema | Solución |
|----------|----------|
| Robot Rock no usa citas, pero ve "Agenda" y bloques de reservas en el Inicio | Módulo `calendars` apagable: desaparece del menú y del Inicio |
| Los ajustes de módulos son casillas pequeñas, poco claras | Interruptores tipo switch |
| El Inicio actual habla de citas y salud técnica, no de campañas | Inicio estilo Brevo: qué sale hoy, cómo fueron las últimas campañas, cuántos contactos hay |
| No sabemos cuánta gente abre los emails, solo los clicks | Píxel de apertura en cada envío → "Índice de apertura" |
| La base de Robot Rock (~2.300 contactos) está en Brevo y el importador solo entiende GHL | Detección automática del CSV de Brevo, etiqueta para todo el lote, bloqueados → dados de baja |

**Valor de negocio**: Robot Rock puede dejar Brevo y hacer su mailing entero en su instancia,
con las métricas que ya conoce (apertura, clicks) y su base de compradores migrada en un paso.

## Qué

### Criterios de Éxito
- [ ] Ajustes → Módulos muestra 5 interruptores tipo switch (Agenda, Cursos, Embudos, Sitios web, Formularios), accesibles por teclado (`role="switch"` + `aria-checked`, espacio/enter alterna), todos ON por defecto.
- [ ] Con Agenda OFF: desaparece "Agenda" del sidebar, `/calendars` y subrutas redirigen a `/dashboard`, el Inicio no muestra nada de citas; `/book/[slug]` y la gestión pública de citas siguen respondiendo.
- [ ] "Salud del sistema" aparece en Ajustes y ya no en el Inicio.
- [ ] El Inicio muestra "Hola, {nombre}", mini calendario navegable con el panel "Programado para el {día}" (o "Nada programado para hoy"), tarjetas de sugerencia (Formularios solo si su módulo está ON), "Tus últimas campañas" con apertura / clics / conversiones, y "Tus contactos" (total + nuevos 30 días).
- [ ] Un email de campaña enviado tras el cambio, al abrirse, marca `opened_at` (una sola vez) y el Inicio y /marketing muestran el índice de apertura; un click sin imagen cargada también cuenta como apertura; campañas antiguas muestran "—" en apertura (no 0 %).
- [ ] El CSV real de Brevo (~2.300 filas) se importa desde el diálogo de Contactos con la etiqueta "Compradores 2025 concierto Barcelona Razzmatazz": nombres, teléfono y fecha de alta correctos, los bloqueados quedan dados de baja, reimportar no duplica y a los contactos ya existentes solo se les añade la etiqueta (y la baja si procede).
- [ ] El importador de GHL sigue funcionando igual (ahora también admite la etiqueta común).

### Comportamiento Esperado (Happy Path)
1. Tony entra a robotrock.live → Ajustes → Módulos y apaga **Agenda** con el interruptor; guarda.
   El menú pierde "Agenda". En Ajustes ve también la tarjeta "Salud del sistema".
2. Va a Inicio: "Hola, Tony". Arriba, el calendario del mes con puntos en los días con envíos;
   hoy seleccionado → "Nada programado para hoy" + botón "Crear campaña". Al lado, tarjetas
   "¿Tienes nuevos contactos que organizar?" → Contactos (y "Amplía tu alcance con formularios"
   solo si Formularios está ON).
3. Contactos → Importar → sube el CSV de Brevo. El diálogo detecta "Formato Brevo", escribe la
   etiqueta y pulsa Importar. Resultado: total, nuevos, actualizados, cuántos quedan dados de baja
   y cuántas filas se descartaron (sin email).
4. Crea y envía una campaña. Al día siguiente, en Inicio → "Tus últimas campañas": fecha de envío,
   estado "Enviada", Índice de apertura X %, Índice de clics Y %, Conversiones "—", con un aviso
   discreto: "Apple Mail puede contar aperturas automáticas; el índice real suele ser menor".
5. "Tus contactos": 2.3xx contactos · N nuevos en los últimos 30 días · enlaces "Ver contactos" e
   "Añadir contactos".

---

## Contexto

### Referencias (código real mapeado)
- **PRP-018** (`.claude/PRPs/prp-instance-branding.md`, COMPLETADO): tabla de una fila
  `instance_settings` (0013), `src/features/instance/services/instance-settings.ts`
  (`getInstanceSettings()` con `cache()` y fallback a DEFAULTS si la tabla no existe — `42P01`;
  `requireModule(key)`), `src/features/instance/types/index.ts` (`MODULE_KEYS`),
  `src/actions/instance.ts` (`updateModules` con Zod), `src/features/settings/components/ModulesForm.tsx`
  (`input type=checkbox role=switch` → a convertir), sidebar con `module?: ModuleKey` por item
  (`src/shared/components/sidebar.tsx`, "Agenda" en `NAV_MAIN` aún sin `module`), patrón layout
  de sección `src/app/(main)/courses/layout.tsx` (no existe `calendars/layout.tsx` todavía).
- **Inicio actual**: `src/app/(main)/dashboard/page.tsx` (RSC, `force-dynamic`): Salud del sistema
  (`src/features/dashboard/services/health.ts` → `getSystemHealth()`), KPIs Contactos/Citas próximas/
  Citas este mes (`getBookingStats`), Últimos contactos, Últimas reservas, Automatizaciones en curso
  (`src/features/dashboard/services/queries.ts`). Saludo "Bienvenido a {brand}".
- **Ajustes**: `src/app/(main)/settings/page.tsx` (ya lee `users.full_name` y `getInstanceSettings()`).
- **Campañas**: `db/migrations/0003_email_marketing.sql` — `email_campaigns` (status draft/scheduled/
  sending/sent, `scheduled_at`, `started_at`, `completed_at`) y `campaign_recipients` (`status`,
  `sent_at`, `click_token` único por destinatario, `clicked_at`). **Ojo**: al arrancar una programada,
  `campaign-engine.ts:185` pone `scheduled_at = null` → para envíos pasados usar `started_at`.
  Transiciones a `sending` en `src/actions/marketing.ts:232` (enviar ahora) y `campaign-engine.ts:185` (programadas).
- **Render y envío**: `renderEmailHtml()` en `src/features/marketing/services/render.ts` (lo llaman
  campaign-engine, email-engine de automatizaciones, `/e/[token]` "ver en navegador" y 2 sitios de
  `actions/marketing.ts` — preview y envío de prueba). Emails de automatización "Sencillo" usan `shell()`
  en `src/features/automations/services/email-engine.ts`; `scheduled_emails` tiene `click_token`.
- **Tracking de clicks**: `src/app/r/[token]/route.ts` (primero `scheduled_emails`, luego campañas;
  marca `clicked_at` solo la primera vez + activity). **Proxy**: `src/proxy.ts` `RESERVED_SEGMENTS`
  (incluye `r`, `e`), matcher excluye extensiones de imagen.
- **Stats de Marketing**: `listCampaigns()` en `src/features/marketing/services/queries.ts` (sent, clicks)
  + `StatsView.tsx` (embudo Destinatarios → Entregados → Con click, tabla por campaña y por destinatario).
- **Crear campaña**: `CreateCampaignButton.tsx` (client, `createCampaign()` → `/marketing/campaigns/[id]`) — reutilizar.
- **Importador**: `src/features/contacts/services/csv-import.ts` (`parseGhlCsv`, papaparse, `header:true`),
  `src/features/contacts/components/ImportDialog.tsx` (sube `File` por FormData, título "Importar de
  GoHighLevel"), `importContactsFromCsv` en `src/actions/contacts.ts:141` (upsert FILA A FILA por
  `ghl_contact_id`, sobrescribe tags). `contacts` NO tiene unique en email (dedup por `lower(email)`,
  patrón en `features/assistant/services/crm-data.ts:63`). Bajas: `contacts.unsubscribed_at`.
- Zona horaria del negocio: `Europe/Madrid` (constante `TZ` en scheduling; `date-fns-tz` ya instalado).

### Arquitectura Propuesta (Feature-First)
```
db/migrations/0014_dashboard_opens.sql        # aditiva (ver Modelo de Datos)
src/features/instance/types/index.ts          # + 'calendars' en MODULE_KEYS
src/features/instance/services/instance-settings.ts  # lectura tolerante a columnas que falten
src/actions/instance.ts                       # updateModules + calendars
src/app/(main)/calendars/layout.tsx           # requireModule('calendars')
src/shared/components/ui/Switch.tsx           # switch accesible reutilizable (button role=switch)
src/features/settings/components/ModulesForm.tsx     # usa Switch, + Agenda
src/features/settings/components/SystemHealthCard.tsx # tarjeta movida desde el Inicio
src/features/dashboard/
├── services/queries.ts      # + campañas del mes/día, últimas campañas con métricas, resumen contactos
└── components/
    ├── MiniCalendar.tsx     # RSC pura, navegación por ?month=YYYY-MM&day=YYYY-MM-DD (sin JS cliente)
    ├── ScheduledPanel.tsx   # "Programado para …" + Crear campaña
    ├── SuggestionCards.tsx
    ├── RecentCampaigns.tsx
    └── ContactsSummary.tsx
src/app/(main)/dashboard/page.tsx   # nuevo Inicio
src/app/o/[token]/route.ts          # píxel de apertura (GIF 1×1, no-store)
src/app/r/[token]/route.ts          # + opened_at = coalesce(opened_at, now())
src/features/marketing/services/render.ts  # + opción openPixelUrl
src/features/contacts/services/csv-import.ts  # detectar formato → parseGhlCsv | parseBrevoCsv
src/features/contacts/components/ImportDialog.tsx  # "Importar contactos", etiqueta común, resumen ampliado
src/actions/contacts.ts             # import por lotes set-based, dedup por email para Brevo
```

### Decisiones clave
1. **Agenda = módulo `calendars`** con la misma mecánica de PRP-018 (columna boolean default true,
   sidebar `module: 'calendars'`, `requireModule` en `calendars/layout.tsx`). Lo público (`/book`,
   gestión de citas por token, emails de reserva) NO se toca. En el Inicio, todo lo de citas va tras `modules.calendars`.
2. **Lectura tolerante**: `getInstanceSettings()` pasa a leer la fila como JSON
   (`select to_jsonb(s) - 'logo_data' as j from instance_settings s where id = true`) y cada módulo
   usa `?? true` → si el deploy llega antes que la 0014, el panel funciona (Agenda ON). Guardar módulos
   sí fallará hasta aplicar la SQL (igual que en PRP-018). El resto de consultas con `opened_at`/
   `opens_tracked` NO son tolerantes → **regla: SQL primero, deploy después** (ver Gotchas).
3. **Switch**: componente `Switch` propio (`<button type="button" role="switch" aria-checked>` con
   pista y bolita en tokens `--primary`/`--border`), etiquetado con `aria-labelledby` al texto del módulo.
   Se mantiene el botón "Guardar" (comportamiento actual, cambio quirúrgico).
4. **Nuevo Inicio** (RSC, sin estado cliente): orden → Saludo · [Calendario + Programado] [Sugerencias] ·
   Tus últimas campañas · Tus contactos · (si Agenda ON) Próximas citas compacta · Automatizaciones en curso
   (se conservan: son útiles y no las pidió quitar). Se eliminan los KPIs de citas, "Últimos contactos"
   (lo sustituye "Tus contactos") y "Salud del sistema" (→ Ajustes).
   - **Nombre** del saludo: `users.full_name` (primer nombre); si está vacío, la parte local del email.
   - **Calendario**: mes en `?month=`, día en `?day=` (por defecto hoy en Europe/Madrid). Puntos en días
     con campañas `scheduled` (por `scheduled_at`) o ya arrancadas (por `started_at`). El panel lista las
     del día con hora y estado ("Programada", "Enviando", "Enviada") enlazando a la campaña.
   - **Últimas campañas**: 5 últimas con `status in ('sending','sent')` por `started_at desc`; columnas
     nombre, fecha de envío, estado, nº enviados, apertura, clics, conversiones.
   - **Fórmulas**: Índice de apertura = destinatarios con `opened_at` / destinatarios `sent`;
     Índice de clics = con `clicked_at` / `sent`. Si la campaña es anterior a la medición
     (`opens_tracked = false`) → apertura "—" con tooltip "Esta campaña se envió antes de medir aperturas".
   - **Conversiones = "—"** con tooltip "Todavía no medimos ventas: se activará cuando conectemos la venta
     de entradas". Decisión honesta: no existe tracking de compras y repetir los clics con otro nombre sería
     engañoso. Documentar en el PRP al cerrar.
   - **Tus contactos**: total, nuevos (`created_at >= now() - 30 días`), y dados de baja como dato secundario.
     Enlaces "Ver contactos" y "Añadir contactos" (abre `/contacts`, donde están alta e importación).
   - Sugerencia de formularios y cualquier enlace a módulos OFF se ocultan. Sin upsells.
5. **Aperturas**:
   - Token = el `click_token` ya existente (único por destinatario/email) → sin columnas de token nuevas.
   - `GET /o/[token]`: busca en `campaign_recipients` y si no en `scheduled_emails`;
     `update … set opened_at = now() where … and opened_at is null`. SIEMPRE responde el GIF 1×1
     (también con token desconocido o error de BD: nunca 404 ni roto en el email), con
     `Cache-Control: no-store, no-cache, must-revalidate, private`, `Pragma: no-cache`. Sin activity en el
     timeline (evitar ruido; YAGNI).
   - `renderEmailHtml({ openPixelUrl })` → `<img src width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`
     al final del body. Se pasa SOLO en campaign-engine y email-engine (diseñado y `shell()` sencillo).
     NO en `/e/[token]`, preview ni envío de prueba (contarían aperturas falsas).
   - `/r/[token]`: además de `clicked_at`, `opened_at = coalesce(opened_at, now())` (campañas y automatizaciones).
   - Automatizaciones: se registra `scheduled_emails.opened_at` pero no se muestra aún en UI (fuera de alcance).
   - `opens_tracked` en `email_campaigns` se pone a `true` en las dos transiciones a `sending`.
   - `/marketing` → Estadísticas: barra "Con apertura" en el embudo, columna "Aperturas" por campaña y
     columna "Abierto" por destinatario (encaja fácil: mismas queries + 1 campo). Mismo aviso de Apple Mail.
   - Proxy: añadir `'o'` a `RESERVED_SEGMENTS` (coherencia con `r`/`e`); la ruta es pública y sin extensión
     (`/o/<token>`, sin `.gif`, para no caer en la exclusión del matcher ni romper nada). Nada de BD en el proxy.
6. **Importador Brevo**:
   - **Detección**: primera línea con `;` y cabeceras `EMAIL` + (`CONTACT ID` o `_BLOCKLISTED`) → Brevo;
     si no, GHL como hoy. Papaparse con `delimiter: ';'` para Brevo y `transformHeader` que quita BOM y espacios.
   - **Mapeo**: `EMAIL`→email (minúsculas, trim; sin email válido → fila descartada y contada),
     `NOMBRE`→first_name, `APELLIDOS`→last_name, phone = primer no vacío de `SMS`, `WHATSAPP`,
     `LANDLINE_NUMBER`, `ADDED_TIME` (`dd-mm-yyyy`, opcional `HH:mm`) → `created_at` solo para contactos
     NUEVOS, `source = 'brevo_import'`. `CONTACT ID` no se guarda en `ghl_contact_id` (es otro sistema).
     `_listIds` se ignora (IDs de listas de Brevo, sin significado aquí).
   - **Bajas**: `_BLOCKLISTED` no vacío y distinto de `false/0/no` → `unsubscribed_at = now()`. Una baja
     existente NUNCA se revierte por importar.
   - **Etiqueta común**: campo "Etiqueta para todos los importados" (varias separadas por coma; trim + dedup;
     máx. 10 de 60 caracteres, Zod). Se aplica en ambos formatos.
   - **Dedup Brevo** por `lower(email)` (también dentro del propio fichero: se fusionan filas repetidas).
     Existentes: solo se rellenan campos VACÍOS (nombre, apellidos, teléfono — nunca se pisa lo que haya),
     tags = unión dedup, baja si procede. Nuevos: insert con todo + activity 'imported' "Importado desde Brevo".
     GHL mantiene su upsert por `ghl_contact_id` pero las etiquetas comunes se añaden (unión) a sus tags.
   - **Rendimiento**: 2.300 upserts fila a fila contra Neon remoto = minutos (riesgo de timeout de la
     action). Se pasa a operaciones set-based por lotes de 500 (`unnest`/`jsonb_to_recordset`): 1 lookup
     de existentes + 1 insert + 1 update por lote.
   - **Tamaño**: se sigue subiendo el fichero por FormData. Estimación con la muestra real
     (~110 bytes/fila con columnas vacías) → ~2.500 filas ≈ 300 KB < 1 MB por defecto. Se MIDE en la fase
     con un CSV sintético de 2.500 filas con nombres/teléfonos rellenos; solo si supera ~800 KB se sube
     `experimental.serverActions.bodySizeLimit` a `'4mb'` en `next.config.ts`. Diálogo con aviso amable si el
     fichero pasa del límite.
   - Diálogo: título "Importar contactos", texto "Admite exportaciones de GoHighLevel y Brevo", resultado
     ampliado (dados de baja, descartadas sin email).

### Modelo de Datos
```sql
-- 0014_dashboard_opens.sql  (aditiva e idempotente; se puede pegar tal cual en el SQL Editor de Neon)
begin;

alter table instance_settings
  add column if not exists module_calendars boolean not null default true;

alter table campaign_recipients
  add column if not exists opened_at timestamptz;

alter table email_campaigns
  add column if not exists opens_tracked boolean not null default false;

alter table scheduled_emails
  add column if not exists opened_at timestamptz;

-- búsqueda por email en el importador (dedup) y en el resto del CRM
create index if not exists contacts_lower_email_idx on contacts (lower(email));

commit;
-- Sin RLS: el proyecto usa pg directo + auth propia, sin RLS (como el resto de tablas).
```

### Despliegue (orden obligatorio)
1. **BD compartida local + ghl.titanicfactory.com**: el agente aplica `0014` con `scripts/run-sql.js` (Fase 1).
2. **robotrock.live**: el agente NO puede migrar esa BD (bloqueo de permisos) → entregar a Tony el SQL de
   `0014` para pegarlo en el SQL Editor de Neon de Robot Rock **antes** del rebuild en EasyPanel, con una
   consulta de comprobación (`select column_name from information_schema.columns where column_name in
   ('module_calendars','opened_at','opens_tracked')`).
3. Después, deploy/rebuild de ambas instancias. Si se despliega antes de la SQL, el Inicio y /marketing
   fallarían al leer `opened_at`.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Migración 0014 + Agenda activable
**Objetivo**: `0014_dashboard_opens.sql` aplicada en la BD local; `calendars` en `MODULE_KEYS`, lectura
tolerante en `getInstanceSettings()`, `updateModules` ampliado, sidebar con `module: 'calendars'` y
`src/app/(main)/calendars/layout.tsx` con `requireModule`.
**Validación**: columnas presentes vía `information_schema`; con `module_calendars=false` por SQL desaparece
"Agenda" y `/calendars`, `/calendars/bookings`, `/calendars/new` redirigen; `/book/<slug>` publicado responde 200;
simulando la columna ausente (consulta de prueba) la lectura devuelve Agenda ON; `npx tsc --noEmit` limpio.

### Fase 2: Ajustes — interruptores y Salud del sistema
**Objetivo**: componente `Switch` accesible usado en `ModulesForm` (con Agenda) y tarjeta "Salud del sistema"
en Ajustes (extraída del Inicio, mismo `getSystemHealth()`).
**Validación**: en el navegador los 5 switches se alternan con ratón y teclado (espacio), `aria-checked`
cambia, guardar persiste y el sidebar se actualiza; la salud se ve en Ajustes con sus 5 indicadores.

### Fase 3: Medición de aperturas
**Objetivo**: ruta `/o/[token]` (GIF no-store, tolerante a errores), `openPixelUrl` en `renderEmailHtml`
y `shell()`, pasado solo en campaign-engine y email-engine; `/r` marca también `opened_at`; `opens_tracked`
en las transiciones a `sending`; `'o'` en `RESERVED_SEGMENTS`; aperturas en `listCampaigns`/`StatsView`
con aviso de Apple Mail.
**Validación**: campaña real de prueba a un email propio → abrir → `opened_at` relleno una sola vez (segunda
apertura no cambia la fecha); click sin abrir rellena `opened_at`; `/o/token-inventado` → 200 image/gif;
preview, envío de prueba y `/e/[token]` no contienen el píxel; /marketing muestra aperturas y "—" en
campañas antiguas.

### Fase 4: Nuevo Inicio
**Objetivo**: dashboard reescrito con saludo, MiniCalendar + panel del día, sugerencias, últimas campañas
(apertura/clics/conversiones "—"), resumen de contactos, citas solo con Agenda ON y automatizaciones en
curso; respeta módulos apagados.
**Validación**: navegar meses/días por el calendario cambia el panel; día sin envíos → "Nada programado para
hoy"; con una campaña programada de prueba aparece en su día con punto; con Agenda o Formularios OFF no hay
rastro ni enlaces a ellos; screenshots claro/oscuro y con color de marca.

### Fase 5: Importador Brevo + etiqueta común
**Objetivo**: detección de formato, `parseBrevoCsv`, import set-based por lotes con dedup por email,
etiqueta común, bajas por `_BLOCKLISTED`, diálogo ampliado; medir tamaño y ajustar `bodySizeLimit` solo si hace falta.
**Validación**: CSV sintético de 2.500 filas en formato Brevo (con BOM, emails repetidos, mayúsculas, filas sin
email, bloqueados, fechas `dd-mm-yyyy`) importa en < 30 s con recuentos exactos; reimportarlo da 0 nuevos y
no duplica etiquetas; un contacto existente conserva su nombre y gana la etiqueta; bloqueados con
`unsubscribed_at`; un CSV de GHL sigue importando igual. Datos de prueba eliminados al terminar.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end en build de producción y SQL listo para Robot Rock.
**Validación**:
- [ ] `npx tsc --noEmit` pasa (no existe `npm run typecheck`; `next lint` roto en Next 16)
- [ ] `npm run build` exitoso y probado con `next start` (el dev server muere por OOM; ojo earlyoom en el build)
- [ ] Script Playwright (patrón PRP-018): switches, Agenda OFF/ON, Inicio completo, import Brevo, screenshots claro/oscuro
- [ ] Rutas públicas con Agenda OFF: `/book/<slug>` y gestión de cita responden
- [ ] Ajustes restaurados (todo ON) y datos de prueba (contactos, campañas, recipients) limpiados
- [ ] SQL de 0014 + consulta de comprobación entregados a Tony con instrucciones en lenguaje de negocio (SQL primero, luego rebuild)
- [ ] Criterios de éxito cumplidos y memoria del proyecto actualizada

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-11-07: bg-primary-soft/40 no aplica
- **Error**: clases con opacidad sobre colores `var()` (sin alpha-value) no generan CSS.
- **Fix**: usar `bg-bg` (o color sólido). Ya estaba en memoria (PRP-007); repetido → revisar SIEMPRE antes de usar `/NN` sobre tokens.
- **Aplicar en**: cualquier componente con tokens de marca.

### 2026-11-07: Screenshots de modo noche "lavados"
- **Error**: añadir la clase `dark` a mano y capturar al instante deja elementos con `transition-colors` a medio camino (filas grises).
- **Fix**: activar el tema como el usuario (`localStorage.theme='dark'` con addInitScript) y esperar ~800 ms antes de capturar.
- **Aplicar en**: todas las verificaciones visuales de modo noche.

### 2026-11-07: Datos reales al probar el importador
- **Error potencial**: el CSV de prueba incluía un contacto real para probar "solo rellenar vacíos" → el import le rellena campos.
- **Fix**: guardar la fila original antes y restaurarla completa al limpiar. Campañas de prueba con audiencia por etiqueta inexistente y programadas a +10 días (la BD es compartida con producción y su cron).
- **Aplicar en**: cualquier E2E sobre la BD compartida local + ghl.titanicfactory.com.

### Resultado E2E (next start)
27/29 checks OK; los 2 fallos eran del selector del test (cogía el enlace del calendario en vez de la fila de campañas) — verificado en screenshot: apertura 50 %, clics 25 %, conversiones —, antigua "—".
Import Brevo de 2.483 filas (397 KB, < 1 MB, sin tocar bodySizeLimit) en 1,4 s; reimport 0 nuevos.

---

## Gotchas

- [ ] **Orden de despliegue**: SQL 0014 primero, deploy después. Solo `getInstanceSettings()` tolera columnas ausentes; las queries con `opened_at`/`opens_tracked` no.
- [ ] Con `select to_jsonb(s)` los timestamptz llegan como STRING (no `Date`) → adaptar el cálculo de `logoVersion` (`new Date(j.logo_updated_at).getTime()`), y excluir siempre `logo_data`.
- [ ] Las campañas programadas pierden `scheduled_at` al arrancar (`= null`): el calendario usa `scheduled_at` para pendientes y `started_at` para enviadas.
- [ ] Días del calendario en **Europe/Madrid** (no UTC del servidor): una campaña a las 00:30 de Madrid es "ayer" en UTC.
- [ ] El píxel NUNCA en `/e/[token]`, preview ni envío de prueba; y el `/o` debe devolver GIF siempre (un 404/500 aparece como imagen rota en el email).
- [ ] Gmail sirve imágenes vía su proxy y cachea: cuenta la primera apertura, no las repetidas — está bien porque medimos aperturas únicas. Apple Mail (Privacy Protection) precarga imágenes → infla aperturas: avisarlo en UI.
- [ ] Cada apertura despierta Neon (evento, no poller): aceptable. NO añadir pollers ≤5 min (GOTCHA NEON COSTE).
- [ ] `RESERVED_SEGMENTS` del proxy: añadir `'o'`; la ruta va sin extensión `.gif` (el matcher excluye imágenes y en dominio propio no debe tratarse como página de funnel).
- [ ] Brevo: separador `;`, posible BOM en la primera cabecera (`﻿CONTACT ID`), fechas `dd-mm-yyyy` (con `new Date()` se interpretan mal → parseo manual), `_SUBSCRIBED` con formato `['email_marketing'|'sms_marketing']`.
- [ ] `contacts.email` no es único: dedup por `lower(trim(email))` y fusionar repetidos dentro del mismo CSV antes de insertar.
- [ ] Importar con `ADDED_TIME` original hace que esos contactos NO cuenten como "nuevos en 30 días" (correcto: no son nuevos). Contarlo a Tony.
- [ ] Límite de body 1 MB de server actions: medir antes de tocar `bodySizeLimit`.
- [ ] El build local lo mata earlyoom → workaround documentado en memoria (tsc aparte + `cpus:1`, revertir).
- [ ] `pkill -f` dentro de un comando Bash se mata a sí mismo → parar servers por PID.

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (módulos como en PRP-018, actions con Zod, `ui.ts`)
- NO copiar marca, colores ni textos de Brevo; nada de botones de upsell
- NO consultar la BD desde `proxy.ts`
- NO pisar datos existentes de un contacto al importar ni revertir una baja
- NO inventar métricas (conversiones "—" hasta que exista medición real)
- NO ignorar errores de TypeScript ni omitir validación Zod en la etiqueta común

## Preguntas abiertas (para confirmar al aprobar)

- RESUELTA (Tony 2026-11-07): sin `email_marketing` en `_SUBSCRIBED` → también se importa como dado de baja.
  a emails en Brevo), ¿lo importamos también como dado de baja? Propuesta por defecto: **sí** (más seguro
  con RGPD y es lo que Brevo hacía); el resumen del import mostrará cuántos son por cada motivo.

---

*PRP completado. Pendiente: SQL 0014 en Robot Rock ANTES del deploy.*
