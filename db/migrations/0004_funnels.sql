-- PRP-009: Funnels (landing pages y embudos de venta con multidominio, tracking y A/B)

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

-- El diseño de página vive en la variante: todo paso nace con 'A';
-- activar A/B crea la 'B'; declarar ganadora deja una sola 'A'.
create table funnel_step_variants (
  id uuid primary key default gen_random_uuid(),
  step_id uuid references funnel_steps(id) on delete cascade not null,
  variant_key text not null default 'A',        -- 'A' | 'B'
  design jsonb not null default '{}',           -- PageDesign {version, styles, sections[]}
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (step_id, variant_key)
);

-- Dominios propios servidos por rewrite en proxy.ts (alta en EasyPanel manual)
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
