# PRP-018: Instancia configurable (marca blanca + módulos activables)

> **Estado**: COMPLETADO (2026-11-06)
> **Fecha**: 2026-11-06
> **Proyecto**: GHL Titan

---

## Objetivo

Que cada instancia de GHL Titan (ej. robotrock.live, que solo usa mailing + alguna landing
de evento) pueda, desde **Ajustes**: (1) activar/desactivar las secciones **Cursos, Embudos,
Sitios web y Formularios** del panel, y (2) poner su **marca**: logo subido, nombre de
empresa editable y color de acento del panel.

## Por Qué

| Problema | Solución |
|----------|----------|
| Instancias como robotrock.live ven secciones que no usan (Cursos, Embudos...) → panel ruidoso y confuso | Interruptores por módulo en Ajustes: lo apagado desaparece del menú |
| Todas las instancias se ven como "GHL Titan / Titanic Factory" en azul | Logo, nombre y color propios por instancia, sin tocar código |
| Personalizar una instancia hoy exige un desarrollador y un deploy | Todo se configura desde Ajustes y se aplica al instante |

**Valor de negocio**: GHL Titan se puede entregar a clientes como producto propio
(marca blanca) y recortado a lo que cada uno necesita, sin coste de desarrollo por instancia.

## Qué

### Criterios de Éxito
- [ ] En Ajustes hay una tarjeta "Módulos" con 4 interruptores (Cursos, Embudos, Sitios web, Formularios), todos ON por defecto; las instancias existentes se ven igual que hoy tras la migración.
- [ ] Al apagar un módulo desaparece del sidebar (si Embudos + Sitios + Formularios están OFF, desaparece también el encabezado "Web") y entrar a su ruta del panel (`/courses`, `/funnels`, `/websites`, `/forms` y subrutas) redirige a `/dashboard`.
- [ ] Con módulos apagados, lo público SIGUE funcionando: `/learn`, `/p`, `/w`, `/sites`, `/form`, `titan-forms.js`, formularios incrustados en embudos y el dominio propio.
- [ ] En Ajustes hay una tarjeta "Marca" para: subir/quitar logo (png/jpg/webp/svg, máx 500 KB), editar nombre de empresa y elegir color de acento (con "restablecer").
- [ ] Con logo → se muestra arriba a la izquierda del sidebar; sin logo → se muestra el nombre; sin configurar → "GHL Titan / Titanic Factory" como hoy.
- [ ] El nombre configurado aparece en el título de la pestaña del panel y del login/signup.
- [ ] El color de acento se aplica al panel y al login/signup (claro y oscuro), y NO a embudos, webs, emails ni páginas públicas.

### Comportamiento Esperado (Happy Path)
1. Tony entra a robotrock.live → Ajustes.
2. En "Módulos" apaga Cursos, Embudos y Sitios web; guarda. El sidebar se refresca: quedan
   Inicio, Contactos, Agenda, Automatizaciones, Marketing, Asistente IA y, bajo "Web", Formularios.
3. Si pega `/courses` en la URL, aterriza en `/dashboard`. Los cursos ya publicados y sus
   alumnos en `/learn` siguen funcionando.
4. En "Marca" sube el logo de RobotRock, escribe "RobotRock" y elige su color. Guarda.
5. El sidebar muestra el logo, los botones/enlaces activos del panel usan el color nuevo, la
   pestaña dice "RobotRock". Al cerrar sesión, el login muestra el logo/nombre y el color.
6. Las landings de evento (`/p/...`) y los emails se ven exactamente igual que antes.

---

## Contexto

### Referencias (código real mapeado)
- `src/lib/db.ts` — `query`/`queryOne` sobre `pg` (Neon). Sin RLS, sin roles: todos los users son admin.
- `db/migrations/` — última `0012_google_calendar.sql`; se aplican con `scripts/run-sql.js`.
- `src/shared/components/sidebar.tsx` — client component; `NAV_MAIN` (incluye `/courses`),
  `NAV_WEB` (`/funnels`, `/websites`, `/forms`) con encabezado "Web", `NAV_TAIL`; cabecera
  hardcodeada "GHL Titan / Titanic Factory".
- `src/app/(main)/layout.tsx` — server, `force-dynamic`; renderiza `<Sidebar />` → aquí se
  leen los ajustes y se pasan como props.
- `src/app/(auth)/layout.tsx` — server, SIN `force-dynamic`; `login/page.tsx` tiene
  "GHL Titan" hardcodeado (signup idem a revisar).
- `src/app/layout.tsx` — `metadata` estática `title: 'GHL Titan'`.
- `src/app/globals.css` — tokens `--primary`, `--primary-fg`, `--primary-soft` en `:root` y
  `.dark` (`--card` claro `#fff`, oscuro `#1e293b`). Tailwind usa `var()` sin alpha-value.
- `src/app/(main)/settings/page.tsx` + `src/features/settings/components/{ProfileForm,PasswordForm}.tsx` — patrón de tarjetas de Ajustes.
- `src/actions/integrations.ts` — patrón server action (`'use server'` + Zod + `revalidatePath`).
- `src/proxy.ts` — NO se toca (no debe consultar BD por request: GOTCHA NEON scale-to-zero).
- Dashboard (`src/app/(main)/dashboard/page.tsx`) — hoy NO enlaza a cursos/embudos/webs/forms (verificado); revisar en la fase de rutas por si acaso.

### Arquitectura Propuesta (Feature-First)
```
db/migrations/0013_instance_settings.sql     # tabla de una sola fila
src/features/instance/
├── services/instance-settings.ts   # getInstanceSettings() (React cache por request), requireModule(key)
├── lib/brand-theme.ts              # hex → <style> con --primary / --primary-fg / --primary-soft
├── components/BrandStyle.tsx       # <style> inyectado en (main) y (auth)
├── components/BrandHeader.tsx      # logo o nombre o fallback "GHL Titan"
└── types/index.ts                  # ModuleKey, InstanceSettings
src/features/settings/components/
├── ModulesForm.tsx                 # 4 interruptores
└── BrandForm.tsx                   # logo + nombre + color
src/actions/instance.ts             # updateModules, updateBrand, uploadLogo, removeLogo (Zod)
src/app/api/brand/logo/route.ts     # sirve el logo desde BD con cache
src/app/(main)/{courses,funnels,websites,forms}/layout.tsx   # requireModule() → redirect('/dashboard')
```

Decisiones clave:
1. **Una tabla de una sola fila** (`instance_settings`, PK booleana `id = true`) con columnas
   tipadas (no key/value): simple, tipada, una sola query por request.
2. **Módulos = columnas booleanas `default true`** → instancias existentes sin cambios.
3. **Redirección en layouts de servidor por sección** vía `requireModule()`, nunca en `proxy.ts`.
   Las rutas públicas viven fuera de `(main)` y no se ven afectadas por construcción.
4. **Logo en BD (`bytea` + mime)**, subido por FormData (cabe en el límite de 1 MB por defecto
   de server actions), servido por `GET /api/brand/logo?v=<logo_updated_at>` con
   `Cache-Control: public, max-age=31536000, immutable` (la `v` cambia al subir uno nuevo).
   **SVG permitido** pero solo como `<img>` y servido con `Content-Type: image/svg+xml`,
   `X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`
   (si alguien abre la URL directa, no ejecuta scripts). Validación de mime por magic bytes, no por extensión.
5. **Color** validado `^#[0-9a-f]{6}$`. Se inyecta `<style>` solo en layouts `(main)` y `(auth)`:
   `:root{--primary:X;--primary-fg:<blanco|negro por luminancia>;--primary-soft:color-mix(in srgb,X 12%,#fff)}`
   `.dark{--primary:X;--primary-fg:…;--primary-soft:color-mix(in srgb,X 25%,#1e293b)}`.
   Las páginas públicas no cargan ese `<style>` → quedan intactas.
6. **Título**: root layout pasa a `title: { default: 'GHL Titan', template: … }`; `(main)` y `(auth)`
   exportan `generateMetadata()` con el nombre de marca. Las páginas públicas siguen con su propio título y NO consultan ajustes.
7. **Login/signup**: además del color, la cabecera usa el mismo `BrandHeader` (logo o nombre) —
   coherente con la marca; supuesto menor, fácil de revertir.
8. Sin cambios en asistente IA, MCP, emails, embudos ni webs.

### Modelo de Datos
```sql
-- 0013_instance_settings.sql
create table if not exists instance_settings (
  id boolean primary key default true check (id),   -- fila única
  brand_name text check (brand_name is null or char_length(brand_name) between 1 and 60),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-f]{6}$'),
  logo_data bytea,
  logo_mime text check (logo_mime is null or logo_mime in ('image/png','image/jpeg','image/webp','image/svg+xml')),
  logo_updated_at timestamptz,
  module_courses boolean not null default true,
  module_funnels boolean not null default true,
  module_websites boolean not null default true,
  module_forms boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into instance_settings (id) values (true) on conflict do nothing;
-- Sin RLS: el proyecto no usa RLS (pg directo + auth propia), igual que el resto de tablas.
```
`getInstanceSettings()` NUNCA selecciona `logo_data` (solo `logo_updated_at` para saber si hay
logo); los bytes solo los lee `/api/brand/logo`.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Datos y servicio de ajustes
**Objetivo**: Migración `0013_instance_settings.sql` aplicada (fila única con todo ON) y servicio
`getInstanceSettings()` / `requireModule()` + tipos, con fallback a valores por defecto si la fila no existe.
**Validación**: `select * from instance_settings` devuelve 1 fila con módulos `true` y marca `null`; `npx tsc --noEmit` limpio.

### Fase 2: Módulos activables (sidebar + rutas)
**Objetivo**: `(main)/layout.tsx` lee ajustes y pasa módulos activos al `Sidebar` (filtra items y oculta
"Web" si queda vacío); layouts de `courses`, `funnels`, `websites`, `forms` redirigen a `/dashboard` si el módulo está OFF; revisar dashboard por atajos.
**Validación**: con un módulo puesto a `false` por SQL, desaparece del menú y su ruta + subrutas redirigen; rutas públicas (`/learn`, `/p`, `/w`, `/form`, `titan-forms.js`) responden 200.

### Fase 3: Marca (logo, nombre, color, título)
**Objetivo**: ruta `/api/brand/logo` con cache y cabeceras seguras; `BrandHeader` en sidebar y login/signup;
`BrandStyle` inyectado en `(main)` y `(auth)` (con `force-dynamic` en `(auth)`); `generateMetadata` con el nombre.
**Validación**: con marca puesta por SQL, sidebar/login muestran logo o nombre, el acento cambia en claro y oscuro, la pestaña muestra el nombre; una landing `/p/...` mantiene sus colores.

### Fase 4: UI en Ajustes + server actions
**Objetivo**: tarjetas "Módulos" y "Marca" en Ajustes; actions en `src/actions/instance.ts` con Zod
(módulos, nombre, color hex, logo ≤500 KB con magic bytes, quitar logo, restablecer) y `revalidatePath('/', 'layout')`.
**Validación**: desde el navegador: apagar/encender módulos y subir/quitar logo, cambiar nombre/color se refleja al guardar sin recargar a mano; ficheros inválidos (>500 KB, .gif, .exe renombrado) se rechazan con mensaje claro.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end en build de producción.
**Validación**:
- [ ] `npx tsc --noEmit` pasa (no existe `npm run typecheck`; `next lint` roto en Next 16)
- [ ] `npm run build` exitoso y probado con `next start` (el dev server muere por OOM en esta máquina)
- [ ] Playwright (localhost o `http://192.168.1.20:3000`): happy path completo + screenshots claro/oscuro del panel y login
- [ ] Rutas públicas verificadas con módulos OFF
- [ ] Ajustes de prueba restaurados (todo ON, marca vacía) al terminar
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-11-06: Verificar rutas públicas con un recurso PUBLICADO
- **Error**: el E2E dio 404 en `/p/embudo-de-agente-de-ia` con módulos OFF → parecía regresión.
- **Fix**: el embudo estaba en `draft` (404 también con todo ON). No era bug: `/p` vive fuera de `(main)`.
- **Aplicar en**: antes de culpar a un cambio, comprobar `status` del recurso público usado en la prueba.

### 2026-11-06: Textos "GHL Titan" sueltos fuera del sidebar
- **Error**: el saludo del Inicio y el título de /assistant tenían "GHL Titan" hardcodeado.
- **Fix**: saludo con `brandName ?? DEFAULT_BRAND_NAME`; títulos vía `title.template` del layout `(main)`.
- **Aplicar en**: cualquier texto nuevo del panel que nombre la plataforma.

---

## Gotchas

- [ ] `proxy.ts` NO debe consultar la BD (Neon scale-to-zero, GOTCHA NEON): la lógica de módulos va en layouts de servidor.
- [ ] `(auth)/layout.tsx` hoy NO es `force-dynamic`: si pasa a leer la BD, el build intentará prerenderizar login/signup y fallará sin `DATABASE_URL` → añadir `export const dynamic = 'force-dynamic'`.
- [ ] No poner `generateMetadata` con BD en el root layout: haría que TODAS las páginas públicas consultaran ajustes.
- [ ] `getInstanceSettings()` envuelto en `cache()` de React para no repetir la query entre layout, metadata y páginas en el mismo request; nunca seleccionar `logo_data` ahí.
- [ ] SVG = vector XSS: solo `<img>`, `nosniff` + CSP restrictiva en la respuesta; validar contenido real (magic bytes / `<svg` raíz), no la extensión.
- [ ] Server actions tienen límite de body 1 MB por defecto: logo ≤500 KB vía FormData (no base64 en JSON).
- [ ] `--primary-fg` debe calcularse por luminancia: un acento claro (amarillo) con texto blanco es ilegible.
- [ ] Tailwind usa `var()` sin alpha-value → el override por CSS variables funciona sin rebuild.
- [ ] `revalidatePath('/', 'layout')` tras guardar, para refrescar sidebar y estilos.
- [ ] El dev server muere por OOM en esta máquina → validar con `next start`. No borrar `.next` con el server corriendo.

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (seguir ProfileForm / actions con Zod)
- NO ignorar errores de TypeScript
- NO hardcodear "GHL Titan" en nuevos sitios: usar `BrandHeader` / fallback central
- NO omitir validación Zod en inputs de usuario
- NO aplicar el color de marca a páginas públicas, embudos, webs ni emails
- NO bloquear rutas públicas al apagar un módulo (solo se oculta el panel)

---

*PRP completado. E2E verificado con next start (30/31 checks; el fallo era un embudo en borrador, no regresión).*
