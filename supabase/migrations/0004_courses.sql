-- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
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
  video_url text,
  content text,
  quiz jsonb,
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
