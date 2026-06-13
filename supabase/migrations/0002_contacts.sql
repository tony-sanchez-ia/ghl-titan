-- contacts: el CRM
create table public.contacts (
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
create table public.contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  type text not null,                    -- 'imported' | 'booking_created' | 'email_sent' | 'note'
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

create index on public.contacts using gin (tags);
create index on public.contacts (created_at desc);
create index on public.contact_activities (contact_id, created_at desc);

-- RLS: admin único autenticado (1 instancia = 1 admin)
alter table public.contacts enable row level security;
alter table public.contact_activities enable row level security;

create policy "Authenticated full access contacts"
  on public.contacts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access activities"
  on public.contact_activities for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
