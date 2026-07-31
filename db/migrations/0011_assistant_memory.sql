-- PRP-015: memoria persistente del Asistente IA de copywriting
-- Entradas de memoria de marca: las guarda el agente (source 'agent') o Tony (source 'user').
-- Se inyectan completas en el system prompt de cada conversación.

create table if not exists assistant_memories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  source text not null default 'agent' check (source in ('agent', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_memories_created_idx on assistant_memories (created_at);
