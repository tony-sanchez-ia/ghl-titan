# PRP-004: Módulo Cursos (Memberships estilo Kajabi/GHL)

> **Estado**: ✅ COMPLETADO (2026-06-13). Verificado E2E en browser.
> **Fecha**: 2026-06-13
> **Proyecto**: GHL Titan
>
> Implementado: 5 tablas + RLS; admin CRUD (cursos, módulos, lecciones, reordenar, publicar) con editor de dos paneles;
> editores por tipo (vídeo embed, texto markdown, quiz single-choice JSONB); portal alumno /learn/[slug] (enroll por email + cookie,
> visor, quiz interactivo con corrección, progreso por lección); certificado imprimible al 100%. Build OK (17 páginas → 23 rutas totales).
> Decisiones V1: quiz NO bloquea progreso; certificado simple con marca GHL Titan; markdown casero (soporta #h1-3, **negrita**, *cursiva*, listas, enlaces).

---

## Objetivo

Construir un módulo de cursos/memberships que replica la experiencia de GHL: el admin crea cursos con estructura de **módulos → lecciones** (vídeo embebido por URL, texto, o cuestionario single-choice), los publica/despublica y reordena; y los alumnos acceden por un enlace público al curso publicado, navegan las lecciones, marcan progreso por lección, y al completar todo obtienen un certificado simple. El curso real de referencia es **"IA TITANS EXPRESS"** (6 módulos: Introducción, Semana 1–4, Sesión Q&A).

## Por Qué

| Problema | Solución |
|----------|----------|
| El usuario imparte formación en IA y hoy depende de GHL para alojar sus cursos (coste + lock-in) | Cursos propios en GHL Titan, con la misma estructura módulo/lección que ya usa |
| No tiene hosting de vídeo y no quiere gestionarlo | Vídeo por **URL embebida** (YouTube/Vimeo/Bunny). Cero hosting, cero coste de almacenamiento |
| Necesita demostrar aprovechamiento a sus alumnos | Progreso por lección + **certificado** al completar el curso |
| Los alumnos no deben gestionar cuentas complejas todavía | Acceso público por enlace + **identificación por email** (sin login de alumno) |

**Valor de negocio**: Migra la oferta formativa fuera de GHL, elimina coste de plataforma de membresías, y reutiliza la base de contactos existente (el alumno queda vinculado a `contacts` por email, igual que las reservas).

## Qué

### Criterios de Éxito
- [ ] El admin puede crear un curso (título, descripción, imagen de portada por URL, estado borrador/publicado) y verlo en `/courses`.
- [ ] El admin puede crear módulos dentro de un curso y lecciones dentro de un módulo, **reordenarlos** (drag o botones arriba/abajo) y publicar/despublicar cada lección.
- [ ] El admin puede editar cada tipo de lección con su editor: **vídeo** (URL → embed), **texto** (contenido rich/markdown), **cuestionario** (preguntas single-choice con opción correcta marcada).
- [ ] Un alumno entra a `/learn/[slug]` de un curso publicado, se identifica por email (queda inscrito = enrollment ligado a contacto), navega lecciones publicadas y marca cada una como completada.
- [ ] Al completar el 100% de las lecciones publicadas, el alumno puede ver/imprimir un **certificado** con su nombre, el título del curso y la fecha.
- [ ] `npm run typecheck` y `npm run build` pasan; la UI sigue el design system clásico (presets `ui`, iconos lucide).

### Comportamiento Esperado

**Admin (autenticado):**
1. Va a **Cursos** en el sidebar → ve la lista de cursos (portada, título, nº módulos, estado, nº alumnos).
2. "Crear curso" → formulario título/descripción/portada → entra al editor del curso.
3. Editor del curso = layout de dos paneles (como GHL): árbol de módulos/lecciones a la izquierda, editor de la lección seleccionada a la derecha.
4. Añade módulo → añade lección eligiendo tipo (vídeo/texto/cuestionario) → rellena su editor → guarda.
5. Reordena módulos y lecciones; publica/despublica lecciones y el curso entero.
6. Copia el enlace público del curso para compartirlo.

**Alumno (público, sin login):**
1. Abre `/learn/[slug]`. Si no está identificado, formulario de email (+ nombre la primera vez) → se crea/recupera el `enrollment`.
2. Ve el contenido del curso: sidebar con módulos/lecciones publicadas, área principal con la lección actual.
3. Vídeo se reproduce embebido; texto se renderiza; cuestionario muestra preguntas single-choice, corrige al enviar.
4. Botón "Marcar como completada" por lección → barra de progreso del curso.
5. Al 100% → tarjeta "Curso completado" con enlace al certificado `/learn/[slug]/certificate`.

---

## Contexto

### Referencias

**Código a seguir (patrones ya establecidos en este repo):**
- `supabase/migrations/0003_scheduling.sql` — patrón exacto de migración: tablas + índices + RLS `auth.role()='authenticated'`. La nueva migración será `0004_courses.sql`.
- `src/actions/calendars.ts` — patrón de server actions: validación Zod, `createClient()` para admin autenticado, `createAdminClient()` (service-role) para rutas públicas, `revalidatePath`, helper `slugify`, manejo de `error.code === '23505'` (slug duplicado), y **dedup de contacto por email** (createPublicBooking, líneas 222–252) — replicar para el enrollment.
- `src/lib/supabase/admin.ts` — `createAdminClient()` para `/learn/[slug]` (alumno sin sesión), igual que `/book/[slug]`.
- `src/app/book/[slug]/page.tsx` + `src/features/scheduling/` — patrón ruta pública (`export const dynamic = 'force-dynamic'`, `generateMetadata`, service en feature) y estructura feature-first (`components/`, `services/`). Espejar en `src/app/learn/[slug]/` + `src/features/courses/`.
- `src/types/database.ts` — añadir interfaces `Course`, `Module`, `Lesson`, `Enrollment`, `LessonProgress`, `QuizQuestion`/`QuizOption` siguiendo el estilo existente.
- `src/shared/components/sidebar.tsx` (línea 10–13) — añadir item `{ href: '/courses', label: 'Cursos', icon: GraduationCap }`.
- `src/shared/lib/ui.ts` — presets `ui.card / ui.button / ui.buttonPrimary / ui.input`.

**Referencias visuales (`referencias/`):**
- `GHL listado de cursos .png` — grid de tarjetas de curso con portada + nº miembros.
- `GHL Editar contenido curso listado principal.png` — editor del curso.
- `GHL Cursos editar un modulo del curso con video incrustado.png` — layout dos paneles: árbol izq. (módulos/lecciones con check de publicado), reproductor de vídeo centro, nombre de lección.
- `GHL Editar Curso editar modulo cuestionario con pregutnas single choice.png` — editor de cuestionario: preguntas, tipo "Single Choice", opciones, casilla "requiere calificación aprobatoria", mensaje de finalización.
- `GHL Editar curso modulo de curso solo texto modulo de solo texto.png` — lección de solo texto.
- `GHL Editar curso generacion de certificado de aprovechamiento plantilla.png` — certificado de aprovechamiento.

### Decisiones de Arquitectura (resueltas)

1. **Acceso del alumno (el enfoque más simple que funciona):** enlace público a `/learn/[slug]` del curso **publicado** + **identificación por email**. Al introducir el email se busca/crea un `contact` (dedup por email, como `createPublicBooking`) y se crea/recupera un `enrollment(course_id, contact_id)`. El email se guarda en una **cookie httpOnly** (`enrollment_<courseId>`) para no volver a pedirlo. **Sin login de alumno, sin contraseñas.** Toda la lectura/escritura pública va por **service-role** (`createAdminClient`), igual que las reservas. Esto cubre el enrollment "ligado a contacto" sin construir auth de alumno.

2. **Markdown vs HTML:** para V1, lección de texto = **textarea de markdown** renderizado con un parser mínimo propio (párrafos, **negrita**, listas, enlaces) — **sin dependencia nueva**. Si más adelante se necesita rich editing real, se evalúa `react-markdown`. Anti-gold-plating: el editor rich de GHL es excesivo para V1.

3. **Vídeo:** se guarda la **URL** y se normaliza a una URL de **embed** (YouTube `watch?v=`/`youtu.be` → `/embed/`, Vimeo → `player.vimeo.com`, Bunny → iframe directo) en un helper `toEmbedUrl()`. Se renderiza con `<iframe>`. Sin hosting, sin reproductor propio.

4. **Cuestionario:** preguntas single-choice. Se modela como JSONB en la lección (no tablas aparte) — una lección tipo `quiz` guarda `quiz: { questions: [{ id, text, options: [{ id, text }], correct_option_id }], passing: boolean }`. Para V1 el quiz **no bloquea** el progreso (se marca completada al enviar); "requiere calificación aprobatoria" se modela como flag pero su enforcement queda fuera de V1 (anti-gold-plating, documentado en Gotchas).

5. **Orden:** columna `position` (integer) en `modules` y `lessons`. Reordenar = server action que reescribe positions (patrón simple, como `setAvailability` reescribe franjas).

6. **Certificado:** página `/learn/[slug]/certificate` que solo renderiza si el enrollment tiene 100% de lecciones publicadas completadas. HTML/CSS imprimible (botón "Imprimir / Guardar PDF" usa `window.print()`). Sin librería de PDF.

### Arquitectura Propuesta (Feature-First)

```
src/features/courses/
├── components/
│   ├── CourseCard.tsx            # tarjeta en el grid /courses
│   ├── CourseForm.tsx            # crear/editar metadatos del curso
│   ├── CourseEditor.tsx          # layout dos paneles (árbol + editor)
│   ├── CourseTree.tsx            # árbol módulos/lecciones, reordenar, publicar
│   ├── LessonEditorVideo.tsx     # editor lección vídeo (URL → preview embed)
│   ├── LessonEditorText.tsx      # editor lección texto (markdown)
│   ├── LessonEditorQuiz.tsx      # editor cuestionario single-choice
│   ├── learn/                    # lado alumno (público)
│   │   ├── EnrollGate.tsx        # formulario email/nombre
│   │   ├── LearnSidebar.tsx      # navegación de lecciones publicadas + progreso
│   │   ├── LessonViewer.tsx      # renderiza vídeo/texto/quiz + "marcar completada"
│   │   └── Certificate.tsx       # certificado imprimible
└── services/
    ├── courses.ts                # lectura admin + pública (getCourseForEdit, getPublicCourse)
    ├── embed.ts                  # toEmbedUrl(url) → URL de iframe
    ├── markdown.ts               # render markdown mínimo → HTML seguro
    └── progress.ts               # cálculo de % completado

src/actions/courses.ts            # server actions (CRUD + reorder + publish + enroll + progress)
src/app/(main)/courses/page.tsx                 # grid (admin)
src/app/(main)/courses/new/page.tsx             # crear curso
src/app/(main)/courses/[id]/page.tsx            # editor del curso
src/app/learn/[slug]/page.tsx                   # alumno (público)
src/app/learn/[slug]/certificate/page.tsx       # certificado
supabase/migrations/0004_courses.sql
```

### Modelo de Datos

```sql
-- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,             -- usado en /learn/[slug]
  title text not null,
  description text,
  cover_image_url text,
  status text not null default 'draft',  -- 'draft' | 'published'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- modules (ordenables dentro del curso)
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  position integer not null default 0,
  created_at timestamptz default now() not null
);

-- lessons (ordenables dentro del módulo, publicables, tipadas)
create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.course_modules(id) on delete cascade not null,
  title text not null,
  type text not null,                    -- 'video' | 'text' | 'quiz'
  position integer not null default 0,
  is_published boolean not null default false,
  video_url text,                        -- type='video'
  content text,                          -- type='text' (markdown)
  quiz jsonb,                            -- type='quiz' { questions:[...], passing:bool }
  created_at timestamptz default now() not null
);

-- enrollments (alumno ligado a contacto, dedup por email)
create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  email text not null,
  created_at timestamptz default now() not null,
  unique (course_id, email)
);

-- progreso por lección
create table public.course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.course_enrollments(id) on delete cascade not null,
  lesson_id uuid references public.course_lessons(id) on delete cascade not null,
  completed_at timestamptz default now() not null,
  unique (enrollment_id, lesson_id)
);

create index on public.course_modules (course_id, position);
create index on public.course_lessons (module_id, position);
create index on public.course_enrollments (course_id, email);
create index on public.course_lesson_progress (enrollment_id);

-- RLS: admin único autenticado; el lado alumno va por service-role en el server
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_lesson_progress enable row level security;

create policy "Authenticated full access courses" on public.courses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access course_modules" on public.course_modules
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access course_lessons" on public.course_lessons
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access course_enrollments" on public.course_enrollments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access course_lesson_progress" on public.course_lesson_progress
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

> Aplicar con: `node scripts/run-sql.js supabase/migrations/0004_courses.sql`

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico: mapear contexto → generar subtareas → ejecutar).

### Fase 1: Esquema de datos y tipos
**Objetivo**: Migración `0004_courses.sql` aplicada (5 tablas + índices + RLS) y tipos `Course`, `Module`, `Lesson` (con tipo de quiz), `Enrollment`, `LessonProgress` añadidos a `src/types/database.ts`.
**Validación**: `node scripts/run-sql.js` ejecuta sin error; `list_tables` muestra las 5 tablas con RLS habilitado; `npm run typecheck` pasa.

### Fase 2: CRUD admin de cursos, módulos y lecciones
**Objetivo**: Server actions en `src/actions/courses.ts` (crear/editar/borrar curso con slug; crear/editar/borrar/reordenar módulos y lecciones; publicar/despublicar lección y curso). Grid `/courses`, formulario de curso, y editor de dos paneles con árbol funcional.
**Validación**: Se puede crear el curso "IA TITANS EXPRESS" con sus 6 módulos y lecciones desde la UI; reordenar y publicar persisten en BD.

### Fase 3: Editores por tipo de lección
**Objetivo**: `LessonEditorVideo` (URL → preview embed vía `toEmbedUrl`), `LessonEditorText` (markdown), `LessonEditorQuiz` (preguntas single-choice con opción correcta, añadir/quitar preguntas y opciones, guardado en JSONB).
**Validación**: Una lección de cada tipo se guarda y se vuelve a abrir mostrando el contenido correcto; vídeo de YouTube/Vimeo/Bunny renderiza embebido.

### Fase 4: Portal del alumno (enrollment + visor + progreso)
**Objetivo**: Ruta pública `/learn/[slug]` (service-role): gate de email/nombre → enrollment (dedup contacto por email, cookie httpOnly), sidebar de lecciones publicadas, visor por tipo, cuestionario que corrige al enviar, y "marcar completada" con barra de progreso.
**Validación**: Un alumno se inscribe, navega, completa lecciones y el progreso persiste entre recargas; las lecciones no publicadas y los cursos en borrador no son accesibles.

### Fase 5: Certificado
**Objetivo**: `/learn/[slug]/certificate` que renderiza el certificado imprimible (nombre, curso, fecha) solo si el enrollment completó el 100% de lecciones publicadas; tarjeta "Curso completado" en el visor al llegar al 100%.
**Validación**: Al completar todas las lecciones aparece el certificado; con progreso incompleto la página redirige/bloquea.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end (admin crea/publica, alumno consume/certifica) y nav integrada.
**Validación**:
- [ ] Item "Cursos" en el sidebar navega a `/courses`.
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright: screenshot de `/courses` (admin) y `/learn/[slug]` (alumno) confirman UI.
- [ ] Todos los Criterios de Éxito cumplidos.

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### [pendiente]

---

## Gotchas

- [ ] **Embed de vídeo**: YouTube/Vimeo bloquean iframes sin la URL `/embed`. Normalizar SIEMPRE con `toEmbedUrl()`; nunca incrustar la URL `watch?v=` directa.
- [ ] **Service-role en `/learn`**: igual que `/book`, las páginas del alumno NO tienen sesión → usar `createAdminClient()`. Nunca importar el admin client en un componente cliente (solo server actions / server components).
- [ ] **Filtrado de publicado en lado alumno**: al leer el curso público filtrar `course.status='published'`, `lesson.is_published=true`. Un módulo sin lecciones publicadas no debe aparecer.
- [ ] **Slug duplicado**: capturar `error.code === '23505'` y devolver mensaje amigable, como en `calendars.ts`.
- [ ] **Cookie de enrollment**: httpOnly + por curso; el email identifica al alumno. No exponer datos de otros enrollments.
- [ ] **Quiz "requiere calificación aprobatoria"**: V1 NO bloquea el progreso por nota (se modela el flag pero no se fuerza). Documentar como límite conocido para no sobre-construir.
- [ ] **Markdown casero**: escapar HTML antes de aplicar el formato mínimo para evitar XSS (el contenido lo escribe el admin, pero igual se sanea).
- [ ] **`position`**: al reordenar, reescribir todas las positions del scope (módulo o curso) en una sola action; no asumir huecos.

## Anti-Patrones

- NO añadir hosting de vídeo ni reproductor propio (solo embed por URL).
- NO construir login/auth de alumno en V1 (email + cookie es suficiente).
- NO meter una librería de rich-text o de PDF si markdown casero + `window.print()` cubren el caso.
- NO crear tablas para preguntas/opciones del quiz (JSONB en la lección).
- NO ignorar errores de TypeScript ni omitir validación Zod en inputs.
- NO romper el design system: usar presets `ui` e iconos lucide existentes.

---

*PRP pendiente aprobación. No se ha modificado código.*
