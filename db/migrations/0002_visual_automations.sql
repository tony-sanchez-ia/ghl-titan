-- PRP-006: Automatizaciones visuales (motor por nodos + triggers tipados + tracking de clicks)
-- Convierte el modelo lineal (automation_steps/automation_triggers) al modelo de workflow.

-- Triggers tipados (reemplaza automation_triggers form-only)
create table automation_trigger_defs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  type text not null,                  -- 'form_submitted' | 'booking_created' | 'tag_added'
  config jsonb not null default '{}',  -- { form_id } | { calendar_id | null=todos } | { tag }
  created_at timestamptz default now() not null
);
create index on automation_trigger_defs (automation_id);
create index on automation_trigger_defs (type);

-- Nodos del workflow (árbol vertical: cadena raíz + subcadenas de rama)
create table automation_nodes (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  parent_node_id uuid references automation_nodes(id) on delete cascade, -- null = cadena raíz
  branch text,                     -- null | 'yes' | 'no' (solo hijos de branch_email_click)
  position integer not null default 0,
  type text not null,              -- 'send_email' | 'wait' | 'add_tag' | 'add_note' | 'branch_email_click'
  config jsonb not null default '{}',
  -- send_email: { subject, body } · wait: { delay_value, delay_unit }
  -- add_tag: { tag } · add_note: { note } · branch_email_click: { wait_value, wait_unit }
  created_at timestamptz default now() not null
);
create index on automation_nodes (automation_id, parent_node_id, branch, position);

-- Inscripciones: un contacto recorriendo una automatización (puntero + agenda)
create table automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  status text not null default 'active',  -- 'active' | 'waiting_click' | 'completed' | 'cancelled'
  current_node_id uuid references automation_nodes(id) on delete set null,
  next_run_at timestamptz,                -- cuándo ejecutar el nodo actual
  wait_until timestamptz,                 -- deadline de la rama por click
  waiting_email_id uuid,                  -- scheduled_email cuyo click se espera
  context jsonb not null default '{}',    -- { email, trigger_type, ... }
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index on automation_enrollments (status, next_run_at);
create index on automation_enrollments (contact_id);
-- dedup: solo una inscripción viva por contacto+automatización
create unique index automation_enrollments_active_uniq
  on automation_enrollments (automation_id, contact_id)
  where status in ('active','waiting_click');

-- scheduled_emails se conserva como bandeja de salida + tracking de clicks
alter table scheduled_emails drop constraint scheduled_emails_step_id_fkey;
alter table scheduled_emails alter column step_id drop not null;  -- legado (uuid huérfano permitido)
alter table scheduled_emails
  add column node_id uuid references automation_nodes(id) on delete set null,
  add column enrollment_id uuid references automation_enrollments(id) on delete set null,
  add column click_token text unique,
  add column clicked_at timestamptz;
create index on scheduled_emails (click_token);

-- ── CONVERSIÓN de datos existentes ──────────────────────────────────────────
-- Cada automation_step se convierte en (wait si delay>0) + send_email en la cadena raíz.
insert into automation_nodes (automation_id, parent_node_id, branch, position, type, config)
select automation_id, null, null, position * 2, 'wait',
       jsonb_build_object('delay_value', delay_value, 'delay_unit', delay_unit)
from automation_steps where delay_value > 0;

insert into automation_nodes (automation_id, parent_node_id, branch, position, type, config)
select automation_id, null, null, position * 2 + 1, 'send_email',
       jsonb_build_object('subject', subject, 'body', body)
from automation_steps;

-- Triggers por formulario → trigger_defs tipados
insert into automation_trigger_defs (automation_id, type, config)
select automation_id, 'form_submitted', jsonb_build_object('form_id', form_id)
from automation_triggers;

-- Tablas legadas fuera (los scheduled_emails pendientes sobreviven: FK ya soltada)
drop table automation_triggers;
drop table automation_steps;
