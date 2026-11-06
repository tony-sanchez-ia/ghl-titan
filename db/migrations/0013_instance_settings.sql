-- PRP-018: instancia configurable (módulos activables + marca blanca).
-- Una sola fila (id = true). Defaults = todo ON y sin marca → las instancias existentes no cambian.

begin;

create table if not exists instance_settings (
  id boolean primary key default true check (id),
  brand_name text check (brand_name is null or char_length(brand_name) between 1 and 60),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-f]{6}$'),
  logo_data bytea,
  logo_mime text check (logo_mime is null or logo_mime in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  logo_updated_at timestamptz,
  module_courses boolean not null default true,
  module_funnels boolean not null default true,
  module_websites boolean not null default true,
  module_forms boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into instance_settings (id) values (true) on conflict do nothing;

commit;
