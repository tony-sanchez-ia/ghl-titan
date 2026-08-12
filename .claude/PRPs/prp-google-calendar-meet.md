# PRP-017: Google Calendar + Meet por cita

> **Estado**: COMPLETADO (2026-08-12). Implementado y verificado E2E con fail-open (sin credenciales).
> ACTIVACIÓN PENDIENTE: alta de Tony en Google Cloud → GOOGLE_CLIENT_ID/SECRET en .env.local y
> EasyPanel → conectar desde Ajustes en producción → prueba real con evento+Meet.
> **Fecha**: 2026-08-12
> **Proyecto**: GHL Titan

---

## Objetivo

Conectar la cuenta Google del admin (OAuth) para que cada reserva de la Agenda cree
automáticamente un evento en su Google Calendar con un **enlace de Google Meet único por cita**,
que llega al prospecto en el email de confirmación y se mantiene sincronizado al cancelar o reprogramar.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los calendarios con "Google Meet" no generan enlace real: el email dice "Recibirás los detalles de conexión en breve" y Tony tiene que crear el Meet y enviarlo A MANO por cada cita | Al reservar, Titan crea el evento en Google Calendar con Meet automático y el enlace viaja en el email de confirmación |
| Las citas de Titan no existen en el Google Calendar de Tony (solo ve Outlook) | Cada reserva aparece como evento real en su calendario de Google, y desaparece/se mueve al cancelar/reprogramar |
| Es el último bloqueo funcional para cancelar GoHighLevel (los enlaces de agendación de GHL sí dan Meet) | Paridad con GHL en agendación |

**Valor de negocio**: elimina trabajo manual en CADA cita reservada y desbloquea la baja de GHL (~$100/mes).
Es un pendiente explícito del usuario desde hace semanas (memoria: "conectar Google Calendar (Meet por cita)").

## Qué

### Criterios de Éxito
- [ ] Tony conecta su cuenta de Google desde Ajustes → Integraciones y la card muestra la cuenta conectada (igual que Outlook)
- [ ] Reserva pública en `/book/[slug]` de un calendario tipo "Google Meet" → evento en el Google Calendar de Tony con enlace Meet único
- [ ] El email de confirmación al prospecto incluye el enlace Meet clicable
- [ ] Cancelar la cita (admin) → el evento desaparece de Google Calendar
- [ ] Reprogramar la cita (admin) → el evento se mueve a la nueva hora conservando el mismo enlace Meet
- [ ] Si Google no está conectado o falla, la reserva se crea igual (fail-open, como Outlook)

### Comportamiento Esperado

1. **Conexión (una vez)**: en Ajustes → Integraciones aparece una card "Google Calendar" junto a la de
   Outlook. Tony pulsa "Conectar con Google" → pantalla de consentimiento de Google → vuelve al panel
   con la cuenta enlazada. La card muestra email conectado, aviso si hace falta re-autorizar, y botón desconectar.
2. **Por cada reserva** (con Google conectado): Titan crea un evento en el calendario principal de Google
   con título `{nombre del prospecto} — {nombre del calendario}`, la hora de la cita, el prospecto como
   invitado y las notas. Si el calendario es tipo "Google Meet", el evento incluye un Meet generado por
   Google (único por cita); ese enlace se guarda en la reserva y sale en el email de confirmación y en el panel.
3. **Cancelar** → se borra el evento de Google. **Reprogramar** → se mueve el evento (el Meet no cambia).
4. **Sin conexión o con Google caído**: todo funciona como hoy (el email mantiene el texto
   "Recibirás los detalles de conexión en breve"). Una caída de Google JAMÁS rompe una reserva.

**Fuera de alcance** (decidido para mantenerlo simple):
- Leer libre/ocupado de Google para bloquear huecos (Outlook ya cubre el busy; se puede añadir en otro PRP)
- Selector de calendario destino: los eventos van SIEMPRE al calendario principal (`primary`).
  Así basta un solo scope (`calendar.events`) y la pantalla de consentimiento pide lo mínimo
- Multi-usuario: una sola conexión global, como Outlook (tabla `integration_connections`, fila única por proveedor)

---

## Contexto

### Referencias
- `src/features/integrations/` — patrón completo a seguir (PRP-010 Outlook): card en Ajustes,
  servicios de auth, cifrado de tokens, fail-open con timeout 5s, estado `reauth_required`
- `src/features/integrations/services/token-crypto.ts` — cifrado AES-256-GCM (clave derivada de
  AUTH_SECRET). **Se reutiliza tal cual**
- `src/features/integrations/services/outlook-auth.ts` — patrón de refresh + cache de access token
  en `integration_connections` + `markReauthRequired()`
- `src/actions/calendars.ts` — `createPublicBooking` (L177), `cancelBooking` (L318),
  `rescheduleBooking` (L368): los 3 puntos de enganche
- `src/features/notifications/services/booking-emails.ts` — `locationLine()` ya renderiza
  `location_value` como enlace si empieza por `http`, y ya tiene el fallback "Recibirás los
  detalles de conexión en breve" → **el email no necesita cambios** si guardamos el Meet ahí
- `db/migrations/0007_outlook_integration.sql` — `integration_connections` ya es multi-proveedor
  (`provider` unique) → la conexión Google es una fila `provider = 'google'`, sin tabla nueva
- `src/app/(main)/settings/page.tsx` — donde se monta la card (junto a `OutlookConnectionCard`)
- Docs: Calendar API `events.insert` con `conferenceData.createRequest` + `conferenceDataVersion=1`
  (developers.google.com/calendar/api/v3/reference/events/insert), OAuth web server flow
  (developers.google.com/identity/protocols/oauth2/web-server)

### Decisiones de arquitectura clave

1. **OAuth: authorization code flow con redirect, NO device code**. El device flow de Google
   (el que usamos con Microsoft) NO admite scopes de Calendar — Google lo limita a Drive/YouTube.
   Obligatorio el flujo clásico con redirect.
2. **El redirect vive en el dominio de producción** (`https://ghl.titanicfactory.com/api/integrations/google/callback`).
   Google no permite redirects `http://` fuera de localhost, así que desde la LAN el flujo clásico no puede
   aterrizar en local — pero producción y local comparten la MISMA BD Neon y el MISMO AUTH_SECRET
   (los tokens cifrados se leen en ambos). Conectar es una acción de una sola vez en el panel de
   producción; la card en local lee el estado de la BD compartida y, si no hay conexión, lleva al panel de prod.
3. **Scope mínimo**: `https://www.googleapis.com/auth/calendar.events` (crear/editar/borrar eventos).
   Sin selector de calendario no hace falta ningún scope de lectura.
4. **El enlace Meet se guarda en `bookings.location_value`** (por reserva). El email, el panel y la
   página de confirmación ya renderizan ese campo → cero cambios en el render. Solo se añade
   `bookings.google_event_id` para poder borrar/mover el evento después.
5. **Evento para TODA reserva** con Google conectado (también en_persona/enlace_fijo, sin Meet en esos
   casos): así su Google Calendar refleja la agenda completa. El prospecto va como invitado con
   `sendUpdates: 'none'` — Google NO manda email duplicado (el de confirmación lo manda Titan vía
   Resend), pero la cita sí aparece en el calendario del prospecto si usa Google.
6. **Fail-open estricto** (patrón Outlook): timeout 5s, cualquier error se loguea y la reserva sigue.
   `invalid_grant` al refrescar → `status = 'reauth_required'` → aviso en la card.

### Arquitectura Propuesta (Feature-First)

```
src/features/integrations/
├── components/
│   ├── OutlookConnectionCard.tsx        (existente, no se toca)
│   └── GoogleConnectionCard.tsx         (nueva: estado, conectar, reconectar, desconectar)
└── services/
    ├── token-crypto.ts                  (existente, se reutiliza)
    ├── google-auth.ts                   (URL de consentimiento, canje de code, refresh, conexión BD)
    └── google-events.ts                 (crear evento+Meet, mover, borrar; fail-open 5s)

src/app/api/integrations/google/
├── start/route.ts                       (valida sesión, cookie state httpOnly, redirect a Google)
└── callback/route.ts                    (valida state, canjea code, guarda tokens cifrados, redirect a /settings)

src/actions/integrations.ts              (añadir: disconnectGoogle + lectura de estado)
src/actions/calendars.ts                 (enganches en createPublicBooking / cancelBooking / rescheduleBooking)
```

### Modelo de Datos

```sql
-- db/migrations/0012_google_calendar.sql
begin;

-- El evento de Google asociado a cada cita (null si no había conexión al reservar)
alter table bookings add column google_event_id text;

-- integration_connections (0007) ya es multi-proveedor: la conexión Google es
-- una fila provider='google' (refresh_token_enc, access_token cache, status).
-- Google NO usa calendar_id/calendar_name (eventos siempre en 'primary').

commit;
```

### Configuración (guiada por el agente, ejecuta Tony — 10 min, una vez)

1. console.cloud.google.com → proyecto nuevo → habilitar **Google Calendar API**
2. Pantalla de consentimiento OAuth: External, **publicar "In production"** (ver Gotchas: en
   Testing el refresh token caduca a los 7 días). Sin verificación de Google: solo la usa Tony
   (pantalla "app no verificada" → Continuar, una vez)
3. Credenciales → OAuth Client ID tipo **Web application** → redirect URIs:
   `https://ghl.titanicfactory.com/api/integrations/google/callback` (+ `http://localhost:3000/...` para dev)
4. Env: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` en `.env.local` Y en EasyPanel (runtime).
   Añadirlas a la lista de envs de `DEPLOY.md` y a `.env.easypanel.local`

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo fases. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Conexión OAuth de Google
**Objetivo**: migración 0012 aplicada; `google-auth.ts` + rutas `/api/integrations/google/start|callback`
funcionando; tokens cifrados en `integration_connections` (provider='google'); refresh con cache y
`reauth_required` en `invalid_grant`. Guía de alta en Google Cloud entregada a Tony.
**Validación**: con las credenciales configuradas, completar el consentimiento deja una fila
`provider='google'` con email de cuenta; sin credenciales, error amable (patrón Outlook).

### Fase 2: Card "Google Calendar" en Ajustes
**Objetivo**: `GoogleConnectionCard` en Ajustes → Integraciones junto a Outlook: conectar (enlace al
dominio del callback), cuenta conectada, aviso re-autorizar, desconectar (borra la fila).
**Validación**: screenshot en browser de los 3 estados (sin conectar / conectado / reauth_required).

### Fase 3: Evento + Meet por reserva
**Objetivo**: `createPublicBooking` crea el evento (invitado + notas, `sendUpdates:'none'`; Meet solo
si `location_type='google_meet'`), guarda `google_event_id` y el enlace en `bookings.location_value`,
y el email de confirmación sale con el Meet. Fail-open verificado.
**Validación**: reserva real en `/book` → evento visible en el Google Calendar de Tony con Meet único;
email con el enlace; reserva OK con Google desconectado.

### Fase 4: Sincronía cancelar / reprogramar
**Objetivo**: `cancelBooking` borra el evento (404/410 = ya borrado, éxito); `rescheduleBooking`
mueve el evento a la nueva hora (mismo Meet). Ambos fail-open.
**Validación**: cancelar → desaparece de Google Calendar; reprogramar → se mueve y el enlace no cambia.

### Fase 5: Validación Final
**Objetivo**: sistema funcionando end-to-end, datos de prueba limpios.
**Validación**:
- [ ] `npx tsc --noEmit` pasa (typecheck/lint de npm NO existen en este proyecto)
- [ ] `npm run build` + `next start` OK (validar con next start: el dev server muere por OOM en esta máquina)
- [ ] Playwright confirma la card y el flujo de reserva
- [ ] Criterios de éxito cumplidos; eventos y reservas de prueba borrados (también en Google Calendar)

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-08-12: redirects de rutas API basados en request.url pierden la sesión
- **Error**: `NextResponse.redirect(new URL('/x', request.url))` — en `next start` el host de
  request.url se normaliza (p.ej. a localhost aunque se navegue por 127.0.0.1 o la IP LAN);
  el redirect cambia de host y el navegador NO envía las cookies del host original → parecía
  que getSession() fallaba cuando en realidad se perdía la cookie tras el redirect.
- **Fix**: en flujos con cookies (OAuth, sesión), construir los redirects sobre
  `NEXT_PUBLIC_SITE_URL` (helper `getPanelBaseUrl()` en google-auth.ts), nunca sobre request.url.
- **Aplicar en**: cualquier ruta API que redirija dentro del panel.

### 2026-08-12: route.ts no admite exports propios
- **Error**: exportar `GOOGLE_STATE_COOKIE` desde `start/route.ts` para importarla en el callback —
  Next.js App Router solo permite exportar handlers (GET/POST...) y opciones (dynamic...) en route.ts;
  cualquier otro export rompe el build con "is not a valid Route export field".
- **Fix**: constantes compartidas entre rutas viven en el servicio (`google-auth.ts`), no en la ruta.
- **Aplicar en**: cualquier par de rutas API que compartan constantes/helpers.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **Device flow NO sirve con Google Calendar** (scopes limitados a Drive/YouTube) → code flow
      con redirect, al revés que la integración de Outlook
- [ ] **Consent screen en "Testing" caduca los refresh tokens a los 7 DÍAS** → publicar la app
      "In production" en Google Cloud aunque no esté verificada
- [ ] `access_type=offline` + `prompt=consent` en la URL de autorización o Google NO devuelve
      refresh token (en re-conexiones lo omite si no fuerzas consent)
- [ ] **`conferenceDataVersion=1` como query param en events.insert** o Google ignora
      `conferenceData.createRequest` en silencio (evento sin Meet)
- [ ] `createRequest.requestId` debe ser único por cita (usar `crypto.randomUUID()` — en servidor
      sí existe; el gotcha LAN de randomUUID es solo de cliente)
- [ ] El enlace llega en `event.hangoutLink` en la respuesta del insert
- [ ] **Cookies de state no cruzan orígenes**: el flujo debe empezar y terminar en el MISMO dominio
      (producción). El botón de la card en local enlaza al panel de prod, no inicia el flujo en local
- [ ] `/api/*` NO pasa por proxy.ts (público): el callback debe validar el `state` SIEMPRE y el
      start exigir sesión
- [ ] Los refresh tokens de Google **NO rotan** (a diferencia de Microsoft); si el callback trae uno
      nuevo (re-consent), sobreescribir el guardado
- [ ] `invalid_grant` al refrescar = token revocado/caducado → `reauth_required`, nunca reintentar en bucle
- [ ] Borrar un evento ya borrado a mano en Google → 404/410: tratarlo como éxito
- [ ] `sendUpdates` controla los emails de Google en insert/patch/delete: `'none'` para no duplicar
      con los emails de Resend
- [ ] AUTH_SECRET debe ser IDÉNTICO en local y prod (ya lo es) — los tokens cifrados se comparten vía Neon
- [ ] Al pegar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, verificar el nombre EXACTO de la env
      (gotcha real: OPENROUTER_APIKEY vs OPENROUTER_API_KEY)

## Anti-Patrones

- NO crear tabla nueva de conexiones: `integration_connections` ya es multi-proveedor
- NO añadir columna `meet_link`: `bookings.location_value` ya existe y todo el render la usa
- NO bloquear ni romper una reserva por un fallo de Google (fail-open SIEMPRE)
- NO pedir scopes de más (`calendar` completo o lectura): solo `calendar.events`
- NO guardar tokens en claro ni loguearlos: cifrar con `token-crypto.ts`
- NO ignorar errores de TypeScript; NO hardcodear URLs (usar `NEXT_PUBLIC_SITE_URL`)

---

*PRP pendiente aprobación. No se ha modificado código.*
