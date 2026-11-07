-- PRP-019: Agenda activable + medición de aperturas + índice para dedup por email.
-- Aditiva e idempotente: se puede pegar tal cual en el SQL Editor de Neon.

begin;

alter table instance_settings
  add column if not exists module_calendars boolean not null default true;

alter table campaign_recipients
  add column if not exists opened_at timestamptz;

alter table email_campaigns
  add column if not exists opens_tracked boolean not null default false;

alter table scheduled_emails
  add column if not exists opened_at timestamptz;

-- dedup por email en el importador y búsquedas del CRM
create index if not exists contacts_lower_email_idx on contacts (lower(email));

commit;
