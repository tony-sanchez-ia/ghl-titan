-- PRP-014: sitios web multidominio (tipo GHL "Sitios web").

begin;

create table websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,              -- vista previa en dominio principal: /w/[slug]
  brief text,                             -- contexto de negocio para la IA
  favicon_url text,
  head_scripts text,                      -- seguimiento (GA, GTM…) en <head>
  body_scripts text,                      -- seguimiento (Pixel…) al final de <body>
  status text not null default 'draft',   -- 'draft' | 'published'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table website_pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references websites(id) on delete cascade not null,
  slug text not null,                     -- '/pagina' en el dominio del sitio
  name text not null,
  is_home boolean not null default false, -- la que sirve la raíz del dominio
  seo_title text,
  seo_description text,
  design jsonb not null default '{}',     -- PageDesign (mismo formato que funnels)
  position int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (website_id, slug)
);

-- Dominios propios apuntando a un sitio (mismo mecanismo que funnel_domains)
create table website_domains (
  id uuid primary key default gen_random_uuid(),
  hostname text unique not null,
  website_id uuid references websites(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create index on website_pages (website_id, position);

commit;
