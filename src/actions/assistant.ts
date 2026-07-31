'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query } from '@/lib/db'
import { addMemoryEntry } from '@/features/assistant/services/memory'

const contentSchema = z.string().trim().min(1, 'Escribe algo que recordar').max(500)
const idSchema = z.string().uuid()

export async function addMemory(content: string): Promise<{ success?: boolean; error?: string }> {
  const parsed = contentSchema.safeParse(content)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Contenido inválido' }
  await addMemoryEntry(parsed.data, 'user')
  revalidatePath('/assistant')
  return { success: true }
}

export async function updateMemory(
  id: string,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  const parsedId = idSchema.safeParse(id)
  const parsed = contentSchema.safeParse(content)
  if (!parsedId.success) return { error: 'Memoria inválida' }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Contenido inválido' }
  await query('update assistant_memories set content = $1, updated_at = now() where id = $2', [
    parsed.data,
    parsedId.data,
  ])
  revalidatePath('/assistant')
  return { success: true }
}

export async function deleteMemory(id: string): Promise<{ success?: boolean; error?: string }> {
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { error: 'Memoria inválida' }
  await query('delete from assistant_memories where id = $1', [parsedId.data])
  revalidatePath('/assistant')
  return { success: true }
}

/** Borra TODA la memoria de marca (reset). La UI confirma antes de llamar. */
export async function resetMemory(): Promise<{ success?: boolean; error?: string }> {
  await query('delete from assistant_memories')
  revalidatePath('/assistant')
  return { success: true }
}
