-- PRP-010: Outlook free/busy — conexiones a servicios externos.
-- Una fila por proveedor (hoy solo 'outlook'). El refresh token va cifrado
-- (AES-256-GCM, clave derivada de AUTH_SECRET); el access token es cache de corta vida.

begin;

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text unique not null,                  -- 'outlook'
  account_email text,                             -- cuenta Microsoft conectada (informativo)
  refresh_token_enc text not null,                -- cifrado AES-256-GCM
  access_token text,                              -- cache (corta vida, ~1h)
  access_token_expires_at timestamptz,
  calendar_id text,                               -- calendario de Outlook elegido para consultar
  calendar_name text,                             -- nombre (informativo, para la UI)
  status text not null default 'connected',       -- 'connected' | 'reauth_required'
  connected_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

commit;
