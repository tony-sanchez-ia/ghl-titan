-- Formularios públicos de captura
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Automatizaciones (secuencias drip)
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',   -- 'draft' | 'active'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Pasos de la secuencia (ordenados; delay acumulado tras el paso anterior / alta)
create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  position integer not null default 0,
  delay_value integer not null default 0,
  delay_unit text not null default 'days', -- 'days' | 'hours'
  subject text not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- Vínculo form ↔ automatización
create table public.automation_triggers (
  automation_id uuid references public.automations(id) on delete cascade not null,
  form_id uuid references public.forms(id) on delete cascade not null,
  primary key (automation_id, form_id)
);

-- Emails programados (una fila por paso al inscribir un contacto)
create table public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  step_id uuid references public.automation_steps(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  to_email text not null,
  subject text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed'
  sent_at timestamptz,
  error text,
  created_at timestamptz default now() not null
);

create index on public.automation_steps (automation_id, position);
create index on public.scheduled_emails (status, send_at);
create index on public.scheduled_emails (contact_id);

alter table public.forms enable row level security;
alter table public.automations enable row level security;
alter table public.automation_steps enable row level security;
alter table public.automation_triggers enable row level security;
alter table public.scheduled_emails enable row level security;

create policy "Authenticated full access forms" on public.forms
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access automations" on public.automations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access automation_steps" on public.automation_steps
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access automation_triggers" on public.automation_triggers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access scheduled_emails" on public.scheduled_emails
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
