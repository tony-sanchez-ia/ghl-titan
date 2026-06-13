# PRP-002: Módulo Contactos (CRM)

> **Estado**: ✅ COMPLETADO (2026-06-13) — 189 contactos importados, CRUD + import + filtros verificados en browser, build OK.
> Nota: ejecutado con design system CLÁSICO (claro/oscuro), no Liquid Glass (cambio de look pedido por el usuario).
> **Fecha**: 2026-06-13
> **Proyecto**: GHL Titan (instancia Titanic Factory)

---

## Objetivo

Construir el módulo CRM de contactos: una lista filtrable de contactos, una ficha
individual con timeline de actividad y etiquetas (tags), y un importador del CSV
exportado de GHL que carga los 190 contactos reales con sus tags. Admin único
autenticado, diseño Liquid Glass.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los 190 contactos viven en GoHighLevel (~$100/mes) y son la única razón de peso para no cancelarlo | CRM propio donde residen y se consultan los contactos sin coste de GHL |
| GHL muestra los contactos en una interfaz sobrecargada para una tarea simple | Lista + ficha limpias, en español, con tags coloreados y timeline legible |
| Migrar 190 contactos a mano sería inviable | Importador del CSV de GHL que parsea, deduplica y carga en un click |

**Valor de negocio**: desbloquea el KPI principal del proyecto — *poder cancelar la
suscripción de GoHighLevel*. Los 190 contactos migrados y consultables en el CRM
propio es el primero de los tres entregables de V1 (BUSINESS_LOGIC §5).

## Qué

### Criterios de Éxito
- [ ] Los 190 contactos del CSV se importan correctamente (0 duplicados al reimportar; dedup por `ghl_contact_id`)
- [ ] La lista de contactos muestra nombre, email, teléfono y tags; permite buscar por texto y filtrar por tag
- [ ] La ficha de contacto muestra todos sus datos + un timeline de actividad en orden cronológico inverso
- [ ] Los tags se muestran como chips de color y existen como entidad consultable (filtrable desde la lista)
- [ ] Toda la tabla `contacts` y `contact_activities` tiene RLS habilitado (solo el admin autenticado accede)
- [ ] `npm run build` y typecheck pasan; Playwright confirma lista + ficha + import

### Comportamiento Esperado

**Importar (happy path):**
1. El admin entra a `/contacts`, ve la lista vacía (o con datos previos) y un botón "Importar de GHL".
2. Sube el CSV exportado de GHL. El sistema parsea, normaliza fechas y tags, y muestra un preview con conteo (N nuevos, M actualizados, errores).
3. Confirma. El sistema hace upsert por `ghl_contact_id` y registra una actividad `imported` por contacto nuevo.
4. La lista se refresca con los 190 contactos.

**Consultar:**
1. El admin ve la lista paginada/scrollable, busca por nombre/email/teléfono y filtra por tag.
2. Click en un contacto → ficha con datos, tags editables, y timeline (`imported`, futuras: `booking_created`, `email_sent`).

---

## Contexto

### Referencias del codebase
- `src/features/auth/` — patrón Feature-First a seguir (components / services / types).
- `src/actions/auth.ts` — patrón de Server Actions (`'use server'`, `createClient()` de `@/lib/supabase/server`, validación, `revalidatePath`).
- `src/lib/supabase/server.ts` — cliente Supabase server-side (SSR, cookies). Usar este en Server Components y Actions.
- `src/shared/lib/glass.ts` — presets `glass.card / panel / button / buttonPrimary / input`. Reusar, no reinventar clases.
- `src/shared/components/sidebar.tsx` — **ya enlaza a `/contacts`** (item "Contactos"). No tocar; la ruta debe existir.
- `src/app/(main)/layout.tsx` y `dashboard/page.tsx` — patrón de página dentro del grupo `(main)` (autenticado, sidebar + `<main className="ml-64 p-8">`). El tile "Contactos" del dashboard espera un conteo real.
- `supabase/migrations/0001_profiles.sql` — patrón de migración SQL: `create table` + `enable row level security` + policies. Las nuevas migraciones se ejecutan con `node scripts/run-sql.js supabase/migrations/XXXX_name.sql`.
- `src/types/database.ts` — tipos de la BD; añadir aquí `contacts` y `contact_activities`.
- `referencias/Export_Contacts_undefined_Jun_2026_11_12_PM.csv` — fuente de datos (190 filas).

### Hechos del CSV (verificados)
- Columnas: `Contact Id, First Name, Last Name, Phone, Email, Business Name, Created, Last Activity, Tags`.
- 190 contactos; 102 con tags. `Business Name` casi siempre vacío.
- `Contact Id` = ID externo de GHL (ej. `ZdRSw5rl3g8JEgjsyqWA`) → **clave de deduplicación**.
- `Created` es ISO 8601 con offset (`2026-05-27T20:34:47+02:00`) → parseable directo.
- `Last Activity` es formato humano (`May 27 2026 08:34 PM`) y **puede estar vacío** → parsear con tolerancia o guardar como texto.
- `Tags` es lista separada por comas, puede contener emojis y espacios (ej. `🟣 seguimiento programado, gestorias`). Normalizar (trim) y deduplicar.
- A veces el nombre de empresa va en `First Name` con `Last Name` vacío → no asumir que ambos existen.
- Hay filas sin email (ej. `Gestoria roca`) → email NO es obligatorio ni único forzado.

### Arquitectura Propuesta (Feature-First)
```
src/features/contacts/
├── components/
│   ├── ContactsList.tsx        # tabla/lista + búsqueda + filtro por tag
│   ├── ContactCard.tsx         # fila de la lista
│   ├── ContactDetail.tsx       # ficha con datos + tags
│   ├── ActivityTimeline.tsx    # timeline de contact_activities
│   ├── TagChip.tsx             # chip de tag con color
│   └── ImportDialog.tsx        # subir CSV + preview + confirmar
├── services/
│   ├── contacts.ts             # queries (list, getById, upsert) vía supabase server
│   └── csv-import.ts           # parseo + normalización del CSV de GHL
├── types/
│   └── index.ts                # Contact, ContactActivity, ParsedRow
└── (Server Actions en src/actions/contacts.ts, siguiendo el patrón de auth.ts)

src/app/(main)/contacts/
├── page.tsx                    # lista
└── [id]/page.tsx               # ficha
```

### Modelo de Datos
```sql
-- contacts: el CRM
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique,            -- clave de dedup del CSV de GHL (nullable para altas manuales)
  first_name text,
  last_name text,
  email text,
  phone text,
  business_name text,
  tags text[] default '{}',              -- normalizados desde la columna Tags
  source text default 'manual',          -- 'ghl_import' | 'booking' | 'manual'
  created_at timestamptz default now() not null,
  last_activity_at timestamptz,          -- desde 'Last Activity' (nullable)
  updated_at timestamptz default now() not null
);

-- contact_activities: timeline por contacto
create table public.contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  type text not null,                    -- 'imported' | 'booking_created' | 'email_sent' | 'note'
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

create index on public.contacts using gin (tags);
create index on public.contact_activities (contact_id, created_at desc);

-- RLS: admin único autenticado = cualquier usuario logeado (1 instancia = 1 admin)
alter table public.contacts enable row level security;
alter table public.contact_activities enable row level security;

create policy "Authenticated full access contacts"
  on public.contacts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access activities"
  on public.contact_activities for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

> **Decisión RLS**: V1 es admin único por instancia (BUSINESS_LOGIC §4). No hay
> `owner_id` por contacto — cualquier usuario autenticado de la instancia es el
> dueño. Si en el futuro hay equipos, se añade `owner_id` + policies por usuario.

> **Decisión Tags**: V1 los guarda como `text[]` en `contacts` (simple, filtrable
> con índice GIN). NO se crea tabla `tags` separada todavía (YAGNI) — el color del
> chip se deriva del nombre/emoji en el front. Si se necesita gestión de tags
> (renombrar, colores persistentes), se promueve a tabla en fase 2.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Esquema de datos
**Objetivo**: tablas `contacts` y `contact_activities` con RLS e índices, y tipos TS añadidos a `src/types/database.ts`.
**Validación**: migración aplicada con `node scripts/run-sql.js`; `list_tables` muestra ambas tablas con RLS on; typecheck pasa con los nuevos tipos.

### Fase 2: Servicios y Server Actions
**Objetivo**: capa de datos (list con búsqueda/filtro por tag, getById con sus activities, upsert) y el parser/normalizador del CSV de GHL (fechas, tags, dedup por `ghl_contact_id`).
**Validación**: el parser convierte una muestra del CSV real en objetos correctos (tags normalizados, `Created` ISO parseado, `Last Activity` vacío → null); las queries devuelven datos sin error de tipos.

### Fase 3: UI de lista y ficha
**Objetivo**: `/contacts` (lista con búsqueda, filtro por tag, chips de color) y `/contacts/[id]` (ficha + timeline). Estilo Liquid Glass con presets de `glass.ts`.
**Validación**: Playwright navega ambas rutas autenticado y captura screenshot; la lista y la ficha renderizan datos reales.

### Fase 4: Importador CSV
**Objetivo**: `ImportDialog` que sube el CSV, muestra preview (nuevos/actualizados/errores) y confirma el upsert + registra actividad `imported`.
**Validación**: importar el CSV real carga 190 contactos; reimportar no duplica (upsert por `ghl_contact_id`); los 102 contactos con tags muestran sus chips.

### Fase 5: Validación Final
**Objetivo**: sistema CRM funcionando end-to-end + tile "Contactos" del dashboard con conteo real.
**Validación**:
- [ ] `npm run build` exitoso
- [ ] typecheck/lint pasan
- [ ] Playwright: import → lista (190) → filtro por tag → ficha con timeline
- [ ] Todos los Criterios de Éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error encontrado durante la implementación.

_(vacío — se llena durante el bucle agéntico)_

---

## Gotchas

- [ ] **`Last Activity` puede estar vacío** y usa formato humano (`May 27 2026 08:34 PM`), no ISO. Parsear con tolerancia → `null` si falla, no romper el import.
- [ ] **Tags con emojis y espacios** (`🟣 seguimiento programado`). Hacer `trim()` por tag y dedup; no asumir slugs.
- [ ] **Filas sin email y sin apellido** (empresa en `First Name`). Email NO es obligatorio ni unique; no forzar NOT NULL.
- [ ] **Dedup**: la clave es `ghl_contact_id` (unique), NO email. Reimportar = upsert, no insert.
- [ ] **CSV parsing**: hay comas dentro de campos entre comillas (tags) → usar un parser CSV real, no `split(',')`.
- [ ] **Upload de archivo en Next.js 16**: el CSV se procesa server-side (Server Action recibiendo `FormData` con el File), no exponer service key al cliente.
- [ ] **RLS**: usar `auth.role() = 'authenticated'` (admin único). NO dejar las tablas sin policies (Supabase advisor lo marca).
- [ ] La ruta `/contacts` **ya está enlazada en el sidebar** — debe existir o el nav rompe.

## Anti-Patrones

- NO crear una tabla `tags` separada en V1 (YAGNI — `text[]` + índice GIN basta).
- NO añadir `owner_id` por contacto en V1 (admin único).
- NO usar `split(',')` para parsear el CSV (rompe con tags entre comillas).
- NO forzar email unique/NOT NULL (hay contactos sin email).
- NO reinventar clases de estilo: usar presets de `src/shared/lib/glass.ts`.
- NO usar `any`; validar el FormData/CSV con Zod.
- NO ignorar errores de TypeScript ni el advisor de RLS de Supabase.

---

*PRP pendiente aprobación. No se ha modificado código.*
