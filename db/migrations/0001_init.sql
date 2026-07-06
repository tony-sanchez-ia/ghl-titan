-- GHL Titan — esquema completo para Neon (Postgres directo, sin Supabase)
-- Consolidado de las migraciones 0001-0005 de Supabase:
--   * profiles (ligada a auth.users) → users con password_hash propio
--   * RLS eliminado: todo el acceso a datos es server-side (admin único por instancia)

-- users: admin de la instancia (login propio con bcrypt + cookie de sesión)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  password_hash text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- contacts: el CRM
create table contacts (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique,            -- clave de dedup del CSV de GHL (nullable para altas manuales)
  first_name text,
  last_name text,
  email text,
  phone text,
  business_name text,
  tags text[] default '{}',
  source text default 'manual',          -- 'ghl_import' | 'booking' | 'manual'
  created_at timestamptz default now() not null,
  last_activity_at timestamptz,
  updated_at timestamptz default now() not null
);

-- contact_activities: timeline por contacto
create table contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade not null,
  type text not null,                    -- 'imported' | 'booking_created' | 'email_sent' | 'note' | 'form_submitted' | 'enrolled'
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

create index on contacts using gin (tags);
create index on contacts (created_at desc);
create index on contact_activities (contact_id, created_at desc);

-- calendars: tipos de cita configurables por el admin
create table calendars (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,             -- usado en la URL pública /book/[slug]
  name text not null,
  description text,
  duration_min integer not null default 30,
  min_notice_hours integer not null default 12,   -- aviso mínimo de programación
  window_days integer not null default 14,         -- ventana de fechas reservables
  buffer_before_min integer not null default 0,
  buffer_after_min integer not null default 0,
  location_type text not null default 'google_meet',  -- 'google_meet' | 'custom_link' | 'in_person'
  location_value text,                   -- enlace fijo o dirección (hasta auto-Meet)
  timezone text not null default 'Europe/Madrid',
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- calendar_availability: franjas semanales de disponibilidad
create table calendar_availability (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references calendars(id) on delete cascade not null,
  weekday smallint not null check (weekday between 0 and 6),  -- 0=domingo ... 6=sábado (JS getDay)
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now() not null
);

-- bookings: citas reservadas
create table bookings (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references calendars(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',   -- 'confirmed' | 'cancelled'
  location_type text,
  location_value text,
  notes text,
  created_at timestamptz default now() not null
);

create index on calendar_availability (calendar_id, weekday);
create index on bookings (calendar_id, starts_at);
create index on bookings (starts_at);

-- Anti doble-reserva: no dos citas confirmadas en el mismo hueco del mismo calendario
create unique index bookings_no_double on bookings (calendar_id, starts_at)
  where status = 'confirmed';

-- courses
create table courses (
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
create table course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  position integer not null default 0,
  created_at timestamptz default now() not null
);

-- lessons (ordenables dentro del módulo, publicables, tipadas)
create table course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references course_modules(id) on delete cascade not null,
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
create table course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  name text not null,
  email text not null,
  created_at timestamptz default now() not null,
  unique (course_id, email)
);

-- progreso por lección
create table course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references course_enrollments(id) on delete cascade not null,
  lesson_id uuid references course_lessons(id) on delete cascade not null,
  completed_at timestamptz default now() not null,
  unique (enrollment_id, lesson_id)
);

create index on course_modules (course_id, position);
create index on course_lessons (module_id, position);
create index on course_enrollments (course_id, email);
create index on course_lesson_progress (enrollment_id);

-- Formularios públicos de captura
create table forms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Automatizaciones (secuencias drip)
create table automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',   -- 'draft' | 'active'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Pasos de la secuencia (ordenados; delay acumulado tras el paso anterior / alta)
create table automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  position integer not null default 0,
  delay_value integer not null default 0,
  delay_unit text not null default 'days', -- 'days' | 'hours'
  subject text not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- Vínculo form ↔ automatización
create table automation_triggers (
  automation_id uuid references automations(id) on delete cascade not null,
  form_id uuid references forms(id) on delete cascade not null,
  primary key (automation_id, form_id)
);

-- Emails programados (una fila por paso al inscribir un contacto)
create table scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  step_id uuid references automation_steps(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  to_email text not null,
  subject text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed'
  sent_at timestamptz,
  error text,
  created_at timestamptz default now() not null
);

create index on automation_steps (automation_id, position);
create index on scheduled_emails (status, send_at);
create index on scheduled_emails (contact_id);
