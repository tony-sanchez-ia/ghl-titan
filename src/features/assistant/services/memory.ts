import { query, queryOne } from '@/lib/db'

export interface AssistantMemory {
  id: string
  content: string
  source: 'agent' | 'user'
  created_at: string
  updated_at: string
}

export async function listMemories(): Promise<AssistantMemory[]> {
  return query<AssistantMemory>('select * from assistant_memories order by created_at asc')
}

export async function addMemoryEntry(
  content: string,
  source: 'agent' | 'user'
): Promise<AssistantMemory> {
  const row = await queryOne<AssistantMemory>(
    'insert into assistant_memories (content, source) values ($1, $2) returning *',
    [content, source]
  )
  return row!
}

export async function memoryExists(content: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    'select id from assistant_memories where lower(content) = lower($1)',
    [content]
  )
  return Boolean(row)
}

/** Cap defensivo: la memoria completa viaja en el system prompt de cada petición. */
const MAX_CONTEXT_CHARS = 12000

/** Memoria formateada como lista para inyectar en el system prompt ('' si está vacía). */
export async function buildMemoryContext(): Promise<string> {
  const memories = await listMemories()
  let out = ''
  for (const m of memories) {
    const line = `- ${m.content}\n`
    if (out.length + line.length > MAX_CONTEXT_CHARS) break
    out += line
  }
  return out
}
