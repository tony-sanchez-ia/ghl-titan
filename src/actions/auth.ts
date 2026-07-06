'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '@/lib/db'
import { createSession, destroySession, getSession } from '@/lib/auth/session'

type DbUser = {
  id: string
  email: string
  full_name: string | null
  password_hash: string
}

export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  const user = await queryOne<DbUser>('select * from users where lower(email) = $1', [email])
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: 'Email o contraseña incorrectos' }
  }

  await createSession(user)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password || password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  // Instancia de admin único: el registro solo está abierto para crear la primera cuenta
  const existing = await queryOne<{ count: string }>('select count(*) as count from users')
  if (Number(existing?.count ?? 0) > 0) {
    return { error: 'Ya existe una cuenta admin en esta instancia. Inicia sesión.' }
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await queryOne<DbUser>(
    'insert into users (email, password_hash) values ($1, $2) returning *',
    [email, hash]
  )
  if (!user) return { error: 'No se pudo crear la cuenta' }

  await createSession(user)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signout() {
  await destroySession()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function changePassword(formData: FormData) {
  const password = formData.get('password') as string
  if (!password || password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const hash = await bcrypt.hash(password, 10)
  await query('update users set password_hash = $1, updated_at = now() where id = $2', [
    hash,
    session.sub,
  ])
  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const fullName = formData.get('full_name') as string
  const user = await queryOne<DbUser>(
    'update users set full_name = $1, updated_at = now() where id = $2 returning *',
    [fullName, session.sub]
  )
  if (!user) return { error: 'No se pudo actualizar el perfil' }

  // Refresca el nombre guardado en la cookie de sesión
  await createSession(user)
  revalidatePath('/', 'layout')
  return { success: true }
}
