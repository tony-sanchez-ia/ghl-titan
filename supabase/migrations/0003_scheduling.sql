-- calendars: tipos de cita configurables por el admin
create table public.calendars (
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
create table public.calendar_availability (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  weekday smallint not null check (weekday between 0 and 6),  -- 0=domingo ... 6=sábado (JS getDay)
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now() not null
);

-- bookings: citas reservadas
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
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

create index on public.calendar_availability (calendar_id, weekday);
create index on public.bookings (calendar_id, starts_at);
create index on public.bookings (starts_at);

-- Anti doble-reserva: no dos citas confirmadas en el mismo hueco del mismo calendario
create unique index bookings_no_double on public.bookings (calendar_id, starts_at)
  where status = 'confirmed';

-- RLS: admin único autenticado (las lecturas/escrituras públicas van por service-role en el server)
alter table public.calendars enable row level security;
alter table public.calendar_availability enable row level security;
alter table public.bookings enable row level security;

create policy "Authenticated full access calendars"
  on public.calendars for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access availability"
  on public.calendar_availability for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access bookings"
  on public.bookings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
