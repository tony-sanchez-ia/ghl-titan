-- PRP-007: Email Marketing (diseñador visual + campañas masivas + tracking de clicks)

create extension if not exists pgcrypto; -- gen_random_bytes (tokens)

-- Plantillas reutilizables (diseño = bloques JSON)
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  design jsonb not null default '[]',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Campañas
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  design jsonb not null default '[]',      -- bloques del editor
  html_snapshot text,                      -- HTML congelado al enviar
  link_urls text[] default '{}',           -- links del snapshot (validación anti open-redirect)
  status text not null default 'draft',    -- 'draft' | 'scheduled' | 'sending' | 'sent'
  audience jsonb not null default '{"type":"all"}',  -- {type:'all'} | {type:'tags', tags:[...]}
  scheduled_at timestamptz,                -- si programada
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index on email_campaigns (status, scheduled_at);

-- Destinatarios: cola + tracking por contacto
create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  to_email text not null,
  status text not null default 'pending',  -- 'pending' | 'sent' | 'failed' | 'skipped'
  sent_at timestamptz,
  error text,
  click_token text unique not null,        -- token de tracking (por destinatario)
  clicked_at timestamptz,
  created_at timestamptz default now() not null,
  unique (campaign_id, contact_id)         -- idempotencia: jamás dos envíos al mismo contacto
);
create index on campaign_recipients (campaign_id, status);
create index on campaign_recipients (contact_id);

-- Bajas de marketing (a nivel contacto)
alter table contacts
  add column unsubscribed_at timestamptz,
  add column unsubscribe_token text unique default encode(gen_random_bytes(16), 'hex');

-- Rellenar el token en los contactos existentes (el default solo aplica a filas nuevas)
update contacts set unsubscribe_token = encode(gen_random_bytes(16), 'hex')
where unsubscribe_token is null;
