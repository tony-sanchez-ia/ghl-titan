-- PRP-011: Form Builder — editor de formularios tipo GHL
-- Extiende `forms` (conserva id/slug → automatizaciones, funnels y emails siguen
-- apuntando aquí) y añade envíos crudos + eventos de medición (vistas).

begin;

-- 1) Extender forms con diseño, estilos, ajustes y estado de publicación
alter table forms
  add column status   text  not null default 'draft',   -- 'draft' | 'published'
  add column schema   jsonb not null default '{}',       -- FormSchema {version, fields[]}
  add column styles   jsonb not null default '{}',       -- FormStyles
  add column settings jsonb not null default '{}';        -- FormSettings

-- Backfill de formularios existentes: schema clásico (nombre/email/teléfono/mensaje),
-- estilos y ajustes por defecto, publicados para no romper enlaces vivos.
update forms set
  status = 'published',
  schema = jsonb_build_object(
    'version', 1,
    'fields', jsonb_build_array(
      jsonb_build_object('id','fld_name','type','text','key','full_name','label','Nombre','placeholder','Tu nombre','required',true,'width','full'),
      jsonb_build_object('id','fld_email','type','email','key','email','label','Email','placeholder','tu@email.com','required',true,'width','full'),
      jsonb_build_object('id','fld_phone','type','phone','key','phone','label','Teléfono','placeholder','+34 600 000 000','required',false,'width','full'),
      jsonb_build_object('id','fld_msg','type','textarea','key','message','label','Mensaje','required',false,'width','full')
    )
  ),
  styles = jsonb_build_object(
    'theme','clean',
    'background_color','#ffffff',
    'text_color','#0f172a',
    'button_color','#2563eb',
    'button_text_color','#ffffff',
    'border_color','#e2e8f0',
    'border_width',1,
    'border_radius',12,
    'field_radius',8,
    'width',560,
    'label_align','top'
  ),
  settings = jsonb_build_object(
    'submit_label','Enviar',
    'submit_action','message',
    'message_html','<p>¡Gracias! Hemos recibido tus datos. Te escribiremos muy pronto.</p>',
    'redirect_url','',
    'add_tags', '[]'::jsonb
  )
where schema = '{}'::jsonb;

-- 2) Envíos crudos (todos los campos, incluidos los que no mapean a contacto)
create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  data jsonb not null default '{}',        -- { field_key: value }
  visitor_id text,                          -- conversión por visitante único
  created_at timestamptz default now() not null
);
create index on form_submissions (form_id, created_at desc);
create index on form_submissions (contact_id);

-- 3) Eventos de medición (independientes del funnel). V1 registra 'view'.
create table form_events (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  visitor_id text not null,
  type text not null default 'view',        -- 'view' (extensible)
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);
create index on form_events (form_id, type, created_at);
create index on form_events (form_id, visitor_id, type, created_at);

commit;
