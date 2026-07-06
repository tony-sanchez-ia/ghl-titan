# PRP-009: Landing pages y embudos de venta (funnels) con multidominio, IA, tracking y test A/B

> **Estado**: COMPLETADO (2026-07-06). Las 8 fases implementadas y verificadas.
> Pendiente de Tony: OPENROUTER_API_KEY para activar la generación por IA (todo lo demás funciona sin ella).
> **Fecha**: 2026-07-06
> **Proyecto**: GHL Titan
> **Construye sobre**: PRP-006 (automatizaciones visuales), PRP-007 (email marketing) y
> PRP-008 (editor V2 de secciones/columnas/bloques). Reutiliza el patrón de diseño jsonb
> versionado, los formularios públicos existentes (tabla `forms`) y el estilo de tracking
> de `/r/[token]`.

---

## Objetivo

Constructor de embudos de venta tipo GoHighLevel: funnels con pasos (landing → oferta →
gracias) editables con el mismo estilo de editor visual por secciones/bloques, publicados
en **dominios propios del cliente** (EasyPanel/Traefik), con **generación de la página por
IA** a partir de un brief, **tracking de visitas/clicks/conversiones** y **test A/B por paso**.

## Por Qué

| Problema | Solución |
|----------|----------|
| GHL cobra $100/mes y una pieza central son sus funnels; sin esto Titan no lo reemplaza completo | Funnels nativos en Titan: crear, editar y publicar embudos sin herramientas externas |
| Montar una landing desde cero tarda horas y Tony no es diseñador | La IA genera estructura + textos de venta desde un brief; solo se retoca en el editor |
| Cada cliente quiere SU dominio (no `titan.com/p/...`) | Multidominio: un registro DNS + alta del dominio en EasyPanel → Traefik sirve el funnel con SSL |
| Sin datos no se sabe qué página convierte | Tracking de visitas/clicks/envíos por paso y test A/B con comparativa y ganadora |

**Valor de negocio**: cierra el bloque "Sites/Funnels" de GHL (lo que más justifica sus $100/mes).
Las páginas capturan leads que caen directo al CRM + automatizaciones ya construidas
(form → drip → agenda), cerrando el ciclo completo de adquisición dentro de Titan.

## Qué

### Criterios de Éxito
- [x] Puedo crear un funnel con 2+ pasos, editar cada página con el editor visual y publicarlo — verificado E2E en browser
- [x] La IA genera una página completa (estructura + copy de venta) desde un brief y queda editable — implementado con degradación sin API key; prueba con generación real pendiente de OPENROUTER_API_KEY
- [x] Un formulario embebido crea el contacto en el CRM y dispara las automatizaciones — verificado E2E (contacto + actividad + evento + salto al paso siguiente)
- [x] Multidominio: `curl -H "Host: dominio"` sirve el funnel desde su raíz; panel intacto en localhost/IP; runbook DNS+EasyPanel en DEPLOY.md (la prueba con SSL real requiere el VPS)
- [x] Tracking de visitas (dedupe por visitante+día), clicks CTA y envíos; pantalla de estadísticas con % paso a paso — números validados contra queries manuales
- [x] Test A/B: reparto 50/50 sticky por visitante, conversión por variante, declarar ganadora conserva el historial — verificado E2E
- [x] `tsc --noEmit` y `npm run build` pasan; datos de prueba limpiados (189 contactos originales intactos)

### Comportamiento Esperado (Happy Path)

1. Tony entra a **Funnels** (nueva sección del panel) → "Nuevo funnel" → nombre + brief del
   negocio ("curso de trading para principiantes, oferta 97€...").
2. La IA propone el funnel: paso 1 landing (hero, beneficios, testimonios, CTA, formulario),
   paso 2 gracias. Todo aterriza en el editor visual (mismo lenguaje que el editor de emails:
   secciones con columnas + bloques) y Tony retoca textos/colores/imágenes.
3. Publica. La página vive en `https://dominio-principal/p/mi-funnel/inicio` y, si añade el
   dominio `ofertatrading.com` (DNS → VPS + alta en EasyPanel + alta en Titan), en
   `https://ofertatrading.com/` directamente.
4. Un visitante entra (visita registrada), pulsa el CTA (click registrado), rellena el
   formulario (contacto al CRM + automatización disparada + conversión registrada) y cae en
   el paso "gracias".
5. Tony activa un test A/B en la landing: duplica la página, cambia el titular en la variante B.
   El tráfico se reparte 50/50 (cada visitante siempre ve la misma variante). En Estadísticas
   compara conversión A vs B y declara ganadora → esa versión queda como única.

### Supuestos de producto (confirmar con Tony antes de aprobar)

- **Funnels = páginas por pasos**, no un website completo con menú/blog (eso sería otro PRP).
- La IA genera la página **al crearla** y puede reescribir textos de bloques sueltos; no es un
  chat de edición continua (mantener simple la V1).
- El **pago dentro del funnel NO entra** en este PRP (no hay pasarela en Titan aún). El CTA
  final puede enlazar a cualquier URL externa de cobro.
- El test A/B es de **2 variantes por paso** (A/B simple, 50/50), no multivariante.
- Alta de dominios: el paso DNS + EasyPanel es **manual y documentado** (1 vez por dominio).
  Titan no automatiza la creación del dominio en EasyPanel en esta versión.
- La generación de IA requiere `OPENROUTER_API_KEY` (hoy NO configurada — dependencia de Tony).

---

## Contexto

### Referencias (codebase real)

- `src/features/marketing/` — patrón a seguir COMPLETO: editor visual por secciones
  (`EmailBuilder.tsx`, `SectionCanvas.tsx`, `blocks/`), diseño jsonb versionado con migración
  perezosa (`services/design.ts`), saneado sin dependencias (`services/sanitize.ts`),
  render de bloques (`services/render-blocks.ts`) y pantalla de stats (`StatsView.tsx`).
- `src/app/form/[slug]/page.tsx` + `src/features/automations/components/PublicForm.tsx` —
  patrón de página pública SSR y formulario que crea contacto + dispara automatizaciones.
- `src/app/r/[token]/route.ts` — patrón de tracking (registro idempotente + redirect validado
  anti open-redirect). Los clicks de CTA de páginas usarán POST a API, no redirect.
- `src/proxy.ts` — auth por prefijo de ruta. AQUÍ se añade `/funnels` como ruta protegida y la
  **resolución multidominio por header Host** (rewrite interno).
- `src/lib/db.ts` — cliente pg directo a Neon (query/queryOne). Sin RLS (auth propia server-side).
- `db/migrations/0001..0003` + `scripts/run-sql.js` — convención de migraciones SQL numeradas.
- `src/shared/lib/uid.ts` — uid() seguro en contextos no-HTTPS (obligatorio para visitor_id).
- `DEPLOY.md` — EasyPanel/Traefik: dominios por servicio con SSL automático (Let's Encrypt).
- `.claude/skills/ai/` — templates Vercel AI SDK v5 + OpenRouter (usar `structured-outputs`
  para generar el diseño de página validado con Zod).
- NO existe aún ninguna dependencia de IA en package.json → Fase de IA la instala.

### Arquitectura Propuesta (Feature-First)

```
src/features/funnels/
├── components/          # FunnelList, FunnelEditor (pasos), PageBuilder (reusa patrón V2),
│   ├── blocks/          # bloques WEB: heading, texto rico, imagen, botón CTA, vídeo,
│   │                    # formulario embebido, HTML, separador/espaciador
│   ├── DomainSettings.tsx, AbTestPanel.tsx, FunnelStats.tsx
├── services/            # design.ts (PageDesign), render (RSC público), ai-generate.ts,
│                        # tracking.ts, queries.ts, actions.ts (Zod en todos los inputs)
└── types/

src/app/(main)/funnels/           # panel: lista, editor, stats  (añadir '/funnels' a proxy.ts)
src/app/p/[funnel]/[step]/        # página pública SSR (dominio principal)
src/app/sites/[host]/[[...path]]/ # destino del rewrite multidominio (mismo render)
src/app/api/track/route.ts        # eventos: page_view / cta_click / form_submit
```

**Decisiones clave**:

- **PageDesign propio** (jsonb `{version, styles, sections[]}`) inspirado en `EmailDesign`
  pero para web: render con Tailwind/RSC (NO tablas de email), secciones full-width con
  fondo, layouts de columnas reutilizando el concepto `LAYOUT_COLUMNS`. No se fuerza
  compatibilidad entre ambos modelos: el email render es HTML de email, esto es web.
- **El diseño vive en la variante** (`funnel_step_variants`): todo paso nace con variante "A";
  activar A/B crea la "B" como copia. Sin test activo solo se sirve "A". Declarar ganadora =
  la variante ganadora pasa a ser la "A" única.
- **Multidominio**: `proxy.ts` compara el `Host` del request con el dominio principal
  (derivado de `NEXT_PUBLIC_SITE_URL`); si es distinto y existe en `funnel_domains` →
  `NextResponse.rewrite` a `/sites/[host]/[...path]`. Los assets `/_next/*` ya quedan fuera
  por el matcher. En EasyPanel cada dominio del cliente se añade al servicio (Domains) y
  Traefik emite el SSL solo. En dev se prueba con `curl -H "Host: ..."` o `/etc/hosts`.
- **Visitante anónimo**: cookie `tv_id` (uid(), 1 año) puesta en la página pública; da
  asignación sticky de variante A/B y deduplicación de eventos.
- **IA**: Vercel AI SDK v5 + OpenRouter (`generateObject` con schema Zod de PageDesign).
  Server action con brief → JSON de página → se guarda como diseño del paso. Nunca se
  renderiza HTML crudo de la IA: solo bloques tipados pasados por el saneador.

### Modelo de Datos (migración `db/migrations/0004_funnels.sql`)

```sql
create table funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'draft',        -- 'draft' | 'published'
  brief text,                                   -- brief de negocio usado por la IA
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid references funnels(id) on delete cascade not null,
  slug text not null,
  name text not null,
  position integer not null default 0,
  seo_title text,
  seo_description text,
  ab_active boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (funnel_id, slug)
);

create table funnel_step_variants (
  id uuid primary key default gen_random_uuid(),
  step_id uuid references funnel_steps(id) on delete cascade not null,
  variant_key text not null default 'A',        -- 'A' | 'B'
  design jsonb not null default '{}',           -- PageDesign {version, styles, sections[]}
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (step_id, variant_key)
);

create table funnel_domains (
  id uuid primary key default gen_random_uuid(),
  hostname text unique not null,                -- 'ofertatrading.com' (sin protocolo)
  funnel_id uuid references funnels(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create table funnel_events (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid references funnels(id) on delete cascade not null,
  step_id uuid references funnel_steps(id) on delete cascade not null,
  variant_id uuid references funnel_step_variants(id) on delete cascade,
  visitor_id text not null,                     -- cookie tv_id
  type text not null,                           -- 'page_view' | 'cta_click' | 'form_submit'
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);
create index on funnel_events (funnel_id, step_id, type, created_at);
create index on funnel_events (step_id, variant_id, visitor_id, type);
create index on funnel_domains (hostname);
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo FASES. Las subtareas se generan al entrar a cada fase
> con el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Modelo de datos + sección Funnels (CRUD)
**Objetivo**: Migración 0004 aplicada en Neon; sección `/funnels` en el panel (lista, crear,
renombrar, borrar, publicar/despublicar) y gestión de pasos (crear, ordenar, renombrar) con
variante "A" vacía por paso. `/funnels` protegida en proxy.ts y enlazada en el nav del layout.
**Validación**: crear funnel con 2 pasos desde el panel, reordenar, publicar; typecheck pasa.

### Fase 2: Editor visual de páginas + render público
**Objetivo**: `PageBuilder` (patrón editor V2: secciones con columnas + bloques web: heading,
texto rico, imagen, botón CTA, vídeo YouTube, HTML saneado, separador) editando el design
de la variante A, con estilos globales (fondo, color de botones, fuente). Render público SSR
en `/p/[funnel]/[step]` (solo funnels `published`, SEO title/description, 404 si draft).
**Validación**: página montada en el editor se ve idéntica en `/p/...` público; guardar y
reabrir sin pérdidas; HTML malicioso en bloque HTML queda saneado.

### Fase 3: Formulario embebido + tracking de eventos
**Objetivo**: bloque "formulario" que embebe un form existente (tabla `forms`) reutilizando
la lógica de `PublicForm` (contacto al CRM + dispara automatizaciones). Cookie `tv_id` de
visitante, registro de `page_view` (server), `cta_click` y `form_submit` (POST `/api/track`
validado con Zod). Tras enviar, salto automático al paso siguiente del funnel.
**Validación**: visita real → contacto aparece en CRM con actividad, automatización inscrita,
y en BD hay page_view + form_submit del mismo visitor_id; datos de prueba limpiados.

### Fase 4: Generación por IA
**Objetivo**: Vercel AI SDK v5 + OpenRouter instalados (patrón skill `ai`, template
structured-outputs). Al crear un funnel con brief, la IA genera los pasos y el PageDesign
completo (estructura + copy de venta AIDA) validado con Zod; botón "reescribir con IA" en
bloques de texto/heading. Si no hay `OPENROUTER_API_KEY`, la creación manual sigue funcionando
y la UI lo explica sin romper.
**Validación**: brief real → página generada visible en editor y en público; JSON inválido de
la IA se reintenta/rechaza sin corromper el diseño; typecheck pasa.

### Fase 5: Test A/B
**Objetivo**: activar test en un paso (crea variante B como copia editable), reparto 50/50
sticky por `tv_id`, eventos etiquetados con variant_id, panel A/B con conversión por variante
(vistas → submits) y "declarar ganadora" (la ganadora queda como variante A única, test off).
**Validación**: dos navegadores distintos ven variantes distintas y cada uno SIEMPRE la misma;
la conversión por variante cuadra con los eventos en BD; declarar ganadora deja una sola variante.

### Fase 6: Multidominio (EasyPanel/Traefik)
**Objetivo**: UI de dominios por funnel (alta/baja hostname con instrucciones DNS), resolución
por Host en `proxy.ts` → rewrite a `/sites/[host]/[...path]` sirviendo el funnel desde su raíz
(`/` = paso 1). URLs públicas generadas desde el Host del request (NUNCA desde
NEXT_PUBLIC_SITE_URL para funnels). DEPLOY.md actualizado con el runbook: DNS A → alta del
dominio en EasyPanel (SSL Traefik) → alta en Titan.
**Validación**: en local, `curl -H "Host: dominio-prueba.com"` devuelve la landing correcta y
el dominio principal sigue sirviendo el panel intacto; runbook documentado.

### Fase 7: Estadísticas del embudo
**Objetivo**: pantalla de stats por funnel (patrón `StatsView` de marketing): visitantes únicos,
vistas, clicks CTA y conversiones por paso, % de paso a paso (embudo), y comparativa A/B donde
haya test. Rango de fechas simple (7/30 días/todo).
**Validación**: los números de la pantalla cuadran con queries manuales sobre `funnel_events`.

### Fase 8: Validación Final
**Objetivo**: Sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: flujo completo (crear con IA → editar → publicar → visitar → convertir → stats)
- [ ] Criterios de éxito cumplidos y datos de prueba limpiados
- [ ] Ningún archivo >500 líneas

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-07-06: Chromium crashea con presión de memoria (máquina compartida)
- **Error**: Playwright MCP "Page crashed / Target crashed" repetido. La máquina (7.7GB RAM,
  swap 4GB LLENA, otros devs con sesiones activas) no aguanta Chromium + next dev.
- **Fix**: verificar por capas sin browser: (1) sembrar en BD el MISMO JSON que produce el
  editor (scripts/run-sql.js), (2) validar el HTML público con curl + grep, (3) testear
  funciones puras (sanitize) con `npx tsx -e`. El E2E visual se hace UNA vez al final
  (Fase 8), no por fase.
- **Aplicar en**: cualquier sesión en esta máquina con memoria justa. Sesiones de browser
  CORTAS (navegar→actuar→cerrar); los server actions pueden haber llegado aunque el browser
  crashee después del click (verificar en BD antes de repetir).

### 2026-07-06: En máquinas con memoria justa, validar con `next start` (no `next dev`)
- **Error**: el dev server moría cada pocos minutos con SIGTERM (exit 143, oom daemon del
  sistema) con swap llena y varios devs trabajando. El paso "Running TypeScript" de
  `next build` también moría (reintentar cuando baje la presión: acabó pasando).
- **Fix**: para E2E usar build de producción + `NODE_OPTIONS=--max-old-space-size=1024 npx
  next start` — mucho más ligero y estable que `next dev`. Lanzar servers con el mecanismo
  de background del harness (el subshell `(cmd &)` muere con SIGHUP).
- **Aplicar en**: cualquier validación en esta máquina compartida.

### 2026-07-06: EADDRINUSE puede venir de un proceso AJENO (Docker/otros devs)
- **Error**: `next start` falló con EADDRINUSE :3000 — otro proceso (contenedor/otra sesión)
  tomó el puerto entre reinicios. Y contestaba 200 en /login: se puede validar contra la app
  EQUIVOCADA sin darse cuenta.
- **Fix**: antes de validar, confirmar que el server responde contenido PROPIO (curl a una
  ruta nueva del feature, no /login). Fallback de puerto en el comando (`|| ... -p 3010`).
- **Aplicar en**: esta máquina (EasyPanel/Docker de otros proyectos conviven con el dev).

### 2026-07-06: FK on delete cascade se comía el historial del A/B
- **Error**: `funnel_events.variant_id references ... on delete cascade` → declarar ganadora
  (borra la variante perdedora) habría borrado sus eventos históricos.
- **Fix**: migración 0005 cambia a `on delete set null` (los eventos quedan a nivel de paso).
  Pensar SIEMPRE qué pasa con los datos históricos al diseñar borrados en cascada.
- **Aplicar en**: cualquier tabla de eventos/actividad que referencie entidades borrables.

### 2026-07-06: Re-export no mete los nombres en scope local
- **Error**: al mover LAYOUT_COLUMNS a shared dejando `export {...} from` en design.ts,
  las funciones del propio archivo que usaban LAYOUT_COLUMNS dejaron de compilar.
- **Fix**: `import {...} from` + `export {...}` en dos líneas cuando el módulo también
  consume lo que re-exporta.
- **Aplicar en**: cualquier refactor de "mover a shared con shim".

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar (heredadas de PRPs 006-008 + nuevas)

- [ ] Rutas nuevas de `(main)` DEBEN añadirse a `isProtectedRoute` en `src/proxy.ts` (`/funnels`) — gotcha real de PRP-007
- [ ] NUNCA `crypto.randomUUID` en cliente (revienta en LAN por http://IP) → usar `uid()` de `src/shared/lib/uid.ts` (visitor_id, ids de bloques)
- [ ] `NEXT_PUBLIC_SITE_URL` se hornea en el BUILD → URLs públicas de funnels multidominio SIEMPRE desde el header Host del request
- [ ] El matcher de proxy.ts excluye `/_next/*` e imágenes: el rewrite multidominio no debe romper assets ni las rutas públicas existentes (`/book`, `/form`, `/e`, `/r`, `/unsubscribe`, `/learn`)
- [ ] En el rewrite por Host, dominio desconocido → seguir flujo normal (no 404 duro), y el dominio principal jamás entra en la rama multidominio
- [ ] HTML/copy generado por IA: NUNCA renderizar crudo — solo bloques tipados + saneador (patrón `sanitize.ts` sin dependencias, PRP-008)
- [ ] `generateObject` puede devolver JSON que no cumple el schema → validar con Zod y reintentar 1 vez; jamás guardar diseño inválido
- [ ] Colores tipo `bg-primary/40` NO funcionan (tokens var() sin alpha-value) → opacity inline (PRP-007)
- [ ] Toolbars flotantes tapan contenedores vacíos → barras estáticas; contentEditable pierde la selección sin `preventDefault` en mousedown del toolbar (PRP-008)
- [ ] next-themes: gatear todo tras `mounted` (el editor vive en el panel con modo noche)
- [ ] Registrar `page_view` server-side en el RSC público con `force-dynamic` (sin cache); dedupe por visitor+step+día para no inflar vistas
- [ ] Cookie `tv_id` en páginas públicas: `SameSite=Lax`, sin `Secure` hardcodeado (dev es http)
- [ ] SSL multidominio lo emite Traefik al añadir el dominio en EasyPanel — si el DNS no propaga aún, Let's Encrypt falla; documentar reintento
- [ ] Tras mover/renombrar archivos raíz: parar dev server → `rm -rf .next` → arrancar (OOM/ENOENT conocidos)

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (editor V2, PublicForm, StatsView, migraciones SQL numeradas)
- NO reutilizar el render de EMAIL (tablas/inline) para páginas web — render web propio con Tailwind
- NO meter pasarela de pagos, websites completos con menú, ni multivariante (>2 variantes) en esta versión
- NO ignorar errores de TypeScript ni usar `any` (usar `unknown`)
- NO hardcodear dominios ni colores (constantes/tokens)
- NO omitir validación Zod en server actions y `/api/track`
- NO exponer `OPENROUTER_API_KEY` al cliente (solo server actions)

---

*PRP pendiente aprobación. No se ha modificado código.*
