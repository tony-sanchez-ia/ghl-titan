# PRP-010: Outlook free/busy (Microsoft Graph) en el sistema de reservas

> **Estado**: IMPLEMENTADO (2026-07-11). Verificado E2E: card de Ajustes, error amable
> sin client ID, /book con fail-open. PENDIENTE de Tony: registro de app en Azure →
> MICROSOFT_CLIENT_ID en .env.local → enlace real + prueba con un evento ocupado real.
> **Fecha**: 2026-07-10
> **Proyecto**: GHL Titan
> **Construye sobre**: PRP-scheduling (agenda con reservas públicas `/book/[slug]`,
> gestión de citas y reprogramación). Reutiliza `generateSlots` (motor puro de huecos),
> el patrón de acciones en `src/actions/calendars.ts` y la página de Ajustes.

---

## Objetivo

Conectar la cuenta Outlook/Microsoft 365 del negocio desde Ajustes (OAuth device code
flow) y **elegir qué calendario de Outlook consultar**, para que el sistema de reservas
consulte su disponibilidad (free/busy) vía Microsoft Graph: los eventos "ocupado" del
calendario elegido bloquean huecos en la página pública de reservas, en la revalidación
al reservar y en la reprogramación de citas.

## Por Qué

| Problema | Solución |
|----------|----------|
| La agenda de Titan solo conoce SUS citas: si Tony tiene una reunión en Outlook, ese hueco sigue apareciendo como libre y se producen dobles reservas | Titan consulta el free/busy de Outlook al generar huecos y descarta los que chocan con eventos ocupados |
| GHL/Calendly sincronizan con el calendario personal; sin esto la agenda de Titan no es usable como agenda "de verdad" | Conexión OAuth con Microsoft en Ajustes, en 2 clicks, con estado visible (conectado como X / reconectar) |
| Bloquear a mano las franjas en Titan cada vez que surge un compromiso externo es inviable | El bloqueo es automático: lo que esté ocupado en Outlook deja de ofrecerse en `/book/[slug]` |

**Valor de negocio**: elimina las dobles reservas (el fallo más caro de una agenda: cliente
citado en un hueco que ya estaba ocupado) y cierra otra pieza del reemplazo de GHL
(sync de calendario externo), haciendo la agenda usable en el día a día real.

## Qué

### Criterios de Éxito
- [ ] Desde Ajustes puedo conectar una cuenta Microsoft (código de dispositivo: enlace + código corto, funciona desde cualquier máquina de la LAN), ver con qué email quedó conectada y desconectarla
- [ ] Tras conectar, puedo elegir CUÁL de mis calendarios de Outlook se consulta (dropdown), y cambiarlo luego
- [ ] Un evento marcado "ocupado" en Outlook dentro de una franja disponible hace desaparecer ese hueco en `/book/[slug]` (y al borrarlo, el hueco reaparece)
- [ ] Intentar reservar un hueco que acaba de ocuparse en Outlook se rechaza con el mensaje "Ese horario ya no está disponible"
- [ ] La reprogramación de citas (admin) tampoco ofrece huecos ocupados en Outlook
- [ ] Si Microsoft no responde o la conexión caduca, las reservas SIGUEN funcionando (sin Outlook) y Ajustes muestra "Reconectar" — la agenda nunca se cae por Microsoft

### Comportamiento Esperado (Happy Path)

1. Tony entra en **Ajustes → Integraciones** y pulsa "Conectar Outlook".
2. La card muestra un **código corto** (ej. `ABC-DEF-123`) y el enlace
   `microsoft.com/devicelogin`. Tony lo abre EN SU PROPIO NAVEGADOR (cualquier máquina),
   introduce el código, pone su login y contraseña de Microsoft y acepta los permisos de
   **solo lectura** de calendario. Mientras, la card muestra "Esperando autorización…"
   (polling cada 5s).
3. La card pasa a "Conectado como tony@…" con botón "Desconectar" y un **selector de
   calendario** (lista de sus calendarios de Outlook, el predeterminado preseleccionado).
   Elige el que usa para sus agendas personales y guarda.
4. Un cliente abre `/book/[slug]`: Titan pide a Microsoft Graph los eventos del calendario
   elegido en el rango reservable, marca como ocupados los que están "busy", y genera los
   huecos descartando tanto las citas de Titan como los eventos de Outlook.
5. El cliente reserva un hueco libre → flujo actual intacto (contacto + emails + automatizaciones).
6. Si justo antes de confirmar aparece un evento en Outlook sobre ese hueco, la
   revalidación server-side lo detecta y rechaza la reserva con mensaje claro.

---

## Contexto

### Referencias (código existente)
- `src/features/scheduling/services/availability.ts` — `generateSlots` es **pura**
  (calendario + franjas + citas + now → huecos). Los bloqueos son intervalos
  `{starts_at, ends_at}`: los eventos de Outlook pueden inyectarse por ahí SIN tocar la función.
- `src/features/scheduling/services/calendars.ts` — `getPublicCalendarBySlug` ya devuelve
  `bookings` como `Pick<Booking, 'starts_at' | 'ends_at'>[]`: punto de fusión natural.
- `src/actions/calendars.ts` — `createPublicBooking` (revalida el hueco regenerando slots),
  `getRescheduleSlots`. Los 3 puntos donde inyectar el free/busy.
- `src/app/(main)/settings/page.tsx` + `src/features/settings/components/` — patrón de
  cards de Ajustes donde vive la nueva card de Integraciones.
- `src/lib/db.ts` (`query`/`queryOne` sobre pg/Neon), `db/migrations/` (siguiente: 0007; 0006 lo tomó el Form Builder PRP-011),
  `scripts/run-sql.js` para aplicar migraciones. **Sin Supabase ni RLS** (auth propia).
- `src/proxy.ts` — `/settings` ya está protegido; las rutas nuevas van bajo `/api/*`
  (ya pasan por el matcher sin cambios).

### Referencias (docs externas)
- OAuth 2.0 device authorization grant (device code flow):
  `https://learn.microsoft.com/entra/identity-platform/v2-oauth2-device-code`
  (soportado para cuentas personales MSA con tenant `/common` o `/consumers`)
- Microsoft Graph `GET /me/calendars` (listar calendarios: `id`, `name`, `isDefaultCalendar`):
  `https://learn.microsoft.com/graph/api/user-list-calendars`
- Microsoft Graph `GET /me/calendars/{id}/calendarView` (expande recurrencias, devuelve `showAs`):
  `https://learn.microsoft.com/graph/api/calendar-list-calendarview`
- Registro de app: Azure Portal → Entra ID → App registrations.

### Decisiones de arquitectura

1. **Una conexión a nivel de instancia** (un solo Outlook para todo el negocio), aplica a
   TODOS los calendarios activos. Sin toggle por calendario de entrada (YAGNI; añadirlo
   luego es una columna booleana).
2. **Solo lectura free/busy** (scope `Calendars.Read` + `offline_access` + `User.Read`).
   NO se crean eventos en Outlook al reservar — eso es otra feature (futuro PRP).
   El calendario de ESCRITURA de la agenda sigue siendo el previsto (Google Calendar,
   integración aún pendiente — otro PRP).
3. **`calendarView` sobre el calendario ELEGIDO en lugar de `getSchedule`**: `getSchedule`
   solo consulta el calendario predeterminado del usuario y NO funciona con cuentas
   personales (outlook.com); `calendarView` permite apuntar al calendario que Tony elija
   (`/me/calendars/{id}/calendarView`), expande eventos recurrentes automáticamente y
   pagina sin el límite de 62 días. Se filtra `isCancelled = false` y bloquean
   `showAs ∈ {busy, oof}`; `tentative`/`free`/`workingElsewhere` NO bloquean
   (decisión de Tony 2026-07-10: los provisionales no bloquean el hueco).
4. **Device code flow, OAuth artesanal sin librería** (ni MSAL ni next-auth): Azure solo
   permite redirect URIs `http` en localhost, así que el flujo clásico con redirección NO
   puede completarse desde `http://192.168.1.20:3000` (LAN) hasta tener dominio https.
   El device code flow no usa redirect URI: la app pide un código a Microsoft
   (`/common/oauth2/v2.0/devicecode`), Tony lo introduce en `microsoft.com/devicelogin`
   desde cualquier navegador, y el server hace polling al endpoint de token
   (`grant_type=device_code`, respetando `interval` y `slow_down`). Funciona hoy en LAN
   y seguirá funcionando igual en producción. Cliente PÚBLICO: solo `client_id`, SIN
   client secret (ni caducidad de secreto que gestionar). Son 3 fetch (devicecode, token
   polling, refresh) — sin librería. Tenant `common` (cuentas personales y de empresa).
   El `device_code` (secreto efímero, ~15 min) viaja en cookie httpOnly del admin durante
   el enlace, nunca al HTML.
5. **Tokens en Neon, refresh token cifrado** (AES-256-GCM con clave derivada de
   `AUTH_SECRET`, helper propio con `node:crypto`). Access token cacheado en la misma
   fila con su expiración; se refresca bajo demanda.
6. **Fail-open**: timeout corto (~5s) a Graph; si falla, se generan huecos solo con las
   citas de Titan (mismo espíritu que los emails: "no bloquea la reserva"). Si el refresh
   devuelve `invalid_grant`, la conexión pasa a `reauth_required` y Ajustes avisa.
7. Los intervalos de Outlook se fusionan con las citas confirmadas ANTES de llamar a
   `generateSlots`, así que **los buffers del calendario se aplican igual** a los eventos
   de Outlook (supuesto razonable: también necesitas margen alrededor de una reunión externa).
8. **Selección de calendario persistida en la conexión** (`calendar_id`/`calendar_name`).
   Al conectar se preselecciona el predeterminado (`isDefaultCalendar`); si el calendario
   elegido deja de existir en Outlook, Graph devuelve 404 → fail-open + estado
   `reauth_required`-like con aviso en Ajustes para reelegir.

### Arquitectura Propuesta (Feature-First)
```
src/features/integrations/
├── components/
│   └── OutlookConnectionCard.tsx    # estados: no conectado / código+esperando (polling) /
│                                    #   conectado como X (+ selector de calendario) / reconectar
├── services/
│   ├── outlook-auth.ts              # devicecode, polling del token, refresh con rotación, estado conexión
│   ├── outlook-freebusy.ts          # calendarView del calendario elegido, paginado → intervalos UTC
│   └── token-crypto.ts              # AES-256-GCM (clave derivada de AUTH_SECRET)
└── types/

src/actions/integrations.ts   # startOutlookLink (pide devicecode, guarda device_code en cookie
                              #   httpOnly y devuelve user_code + verification_uri),
                              # pollOutlookLink (un intento de canje; guarda tokens al aprobar),
                              # listOutlookCalendars, setOutlookCalendar, disconnectOutlook
```

### Modelo de Datos (migración `db/migrations/0007_outlook_integration.sql`)
```sql
-- Conexiones a servicios externos (hoy solo 'outlook'; una fila por proveedor)
create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text unique not null,                  -- 'outlook'
  account_email text,                             -- cuenta Microsoft conectada (informativo)
  refresh_token_enc text not null,                -- cifrado AES-256-GCM
  access_token text,                              -- cache (corta vida, ~1h)
  access_token_expires_at timestamptz,
  calendar_id text,                               -- calendario de Outlook elegido para consultar
  calendar_name text,                             -- nombre (informativo, para la UI)
  status text not null default 'connected',       -- 'connected' | 'reauth_required'
  connected_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### Variables de entorno nuevas
```
MICROSOFT_CLIENT_ID=        # Application (client) ID del registro de app en Azure
# Cliente público con device code flow: NO hay client secret ni redirect URI
```

### Dependencias (pendiente de Tony, guiado por el agente)
- Cuenta Microsoft y **registro de app en Azure Portal** (Entra ID → App registrations):
  tipo "cuentas en cualquier directorio + cuentas personales (Skype, Xbox...)",
  SIN redirect URI ni client secret; activar **"Allow public client flows" = Yes**
  (Authentication → Advanced settings); permisos delegados `Calendars.Read`,
  `offline_access`, `User.Read`. Copiar solo el Application (client) ID.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Cimientos device code flow + almacenamiento de tokens
**Objetivo**: migración 0007 aplicada; helper de cifrado; servicios `outlook-auth.ts`
(petición de devicecode, canje por polling con manejo de `authorization_pending`/
`slow_down`/`expired_token`/`authorization_declined`, refresh con rotación del refresh
token); actions `startOutlookLink`/`pollOutlookLink`/`disconnectOutlook` (solo con
sesión admin); env var documentada y guía de registro Azure para Tony.
**Validación**: completar el enlace real (Tony introduce el código desde su navegador)
deja una fila en `integration_connections` con `account_email` correcto y tokens
cifrados; un refresh manual renueva el access token y rota el refresh token.

### Fase 2: UI de Integraciones en Ajustes + selección de calendario
**Objetivo**: card "Integraciones" en `/settings` con los 4 estados (no conectado →
botón Conectar; enlazando → código grande + enlace devicelogin + "Esperando…" con
polling cada `interval`s; conectado como X → selector de calendario de Outlook
(`listOutlookCalendars`/`setOutlookCalendar`, predeterminado preseleccionado) +
Desconectar; `reauth_required` → aviso + Reconectar), usando el estilo de cards existente.
**Validación**: E2E en browser — conectar con código, ver el email, elegir calendario,
cambiarlo, desconectar, reconectar.

### Fase 3: Free/busy en la generación de huecos
**Objetivo**: `outlook-freebusy.ts` (calendarView del calendario elegido, paginado en
UTC, filtro showAs, timeout + fail-open, marca `reauth_required` en invalid_grant)
integrado en los 3 puntos: `getPublicCalendarBySlug`, `createPublicBooking` y
`getRescheduleSlots`, fusionando los intervalos de Outlook con las citas confirmadas
antes de `generateSlots` (que no se toca).
**Validación**: con un evento "ocupado" real en Outlook, el hueco desaparece de
`/book/[slug]`; al borrarlo reaparece; reservar un hueco recién ocupado en Outlook se
rechaza; con la conexión rota, los huecos se generan igual (fail-open).

### Fase 4: Validación Final
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso (validar con `next start`, no dev — gotcha máquina compartida)
- [ ] Playwright confirma la card de Ajustes y la página pública de reservas
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-07-11: getPublicCalendarBySlug también lo llama generateMetadata
- **Error (evitado)**: el plan decía fusionar el free/busy dentro de `getPublicCalendarBySlug`,
  pero esa función la llama TAMBIÉN `generateMetadata` en /book/[slug] → habría hecho DOS
  llamadas a Microsoft Graph por visita (hasta +10s de latencia).
- **Fix**: fusionar en los puntos que generan huecos de verdad: la page de /book,
  `createPublicBooking` y `getRescheduleSlots`.
- **Aplicar en**: cualquier servicio que se llame desde generateMetadata + page.

### 2026-07-11: validación E2E sin scripts npm de typecheck/lint
- **Error**: `npm run typecheck` no existe en este proyecto y `npm run lint` (next lint)
  está roto en Next 16 (comando eliminado).
- **Fix**: usar `npx tsc --noEmit` para tipos. Lint queda pendiente de migrar a ESLint CLI.
- **Aplicar en**: todos los checks de este proyecto.

### 2026-07-11: Playwright MCP bloqueado por otro agente en máquina compartida
- **Error**: `browser_navigate` falla con "Browser is already in use" si otro agente tiene
  el perfil MCP abierto.
- **Fix**: script Node con el playwright del caché de npx
  (`~/.npm/_npx/*/node_modules/playwright`) + `executablePath` a un
  `chromium_headless_shell-*` existente de `~/.cache/ms-playwright` (las versiones del
  caché npx y de los browsers instalados pueden no coincidir).
- **Aplicar en**: cualquier validación browser cuando el MCP esté ocupado.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **Se eligió device code flow PORQUE el flujo clásico no funciona en esta LAN**: Azure
      solo permite redirect URIs `http` en localhost, y Tony trabaja desde
      `http://192.168.1.20:3000`. NO "simplificar" a authorization code flow.
- [ ] **Device code**: respetar el `interval` devuelto (5s) y aumentar si llega `slow_down`;
      el código caduca en ~15 min (`expired_token`) → ofrecer "Generar código nuevo".
      Con cuenta personal, Microsoft puede pedir iniciar sesión de nuevo aunque ya hubiera
      sesión en el navegador (no es un bug).
- [ ] **`getSchedule` NO funciona con cuentas Microsoft personales** (outlook.com) y solo lee
      el calendario predeterminado — por eso se usa `calendarView` del calendario elegido,
      que además expande recurrencias (el endpoint `/me/events` NO las expande).
- [ ] **Microsoft ROTA el refresh token en cada refresh**: guardar SIEMPRE el nuevo o la
      conexión muere en ~24h/uso siguiente.
- [ ] **Pedir Graph en UTC** (`Prefer: outlook.timezone="UTC"`) y trabajar en epoch ms como
      el resto de `availability.ts`; no mezclar zonas (el calendario ya maneja Europe/Madrid).
- [ ] `calendarView` pagina (`@odata.nextLink`): seguir los links o se pierden eventos
      (usar `$top=` razonable y `$select=start,end,showAs,isCancelled` para respuestas ligeras).
- [ ] La página `/book/[slug]` es SSR por request: la llamada a Graph añade latencia.
      Empezar SIN caché (timeout 5s + fail-open) y medir; si molesta, cachear 60s después.
- [ ] Gotcha heredado: validar con `next start` (el dev server de esta máquina muere por OOM)
      y confirmar que el puerto sirve TU app (Docker de otros convive en 3000).

## Anti-Patrones

- NO instalar MSAL/next-auth para 2 endpoints y un fetch de refresh (auth propia ya existe)
- NO guardar el refresh token en texto plano (cifrar con clave derivada de AUTH_SECRET)
- NO tocar `generateSlots` (es pura y está verificada): los eventos de Outlook entran como intervalos bloqueados
- NO crear/escribir eventos en Outlook (scope de solo lectura; escribir es otro PRP)
- NO bloquear la reserva si Microsoft está caído (fail-open siempre)
- NO usar Supabase/RLS: la BD es Neon con pg directo y migraciones en `db/migrations/`
- NO exponer el `device_code` al HTML/cliente (solo `user_code` + `verification_uri`; el
  device_code viaja en cookie httpOnly)
- NO omitir validación Zod en las respuestas de Microsoft (devicecode/token/calendars)

---

*PRP pendiente aprobación. No se ha modificado código.*
