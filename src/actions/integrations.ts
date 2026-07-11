'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import {
  requestDeviceCode,
  redeemDeviceCode,
  listOutlookCalendars,
  setOutlookCalendar,
  deleteOutlookConnection,
  getMicrosoftClientId,
  type OutlookCalendar,
} from '@/features/integrations/services/outlook-auth'

/**
 * Enlace de Outlook por device code flow.
 * El device_code (secreto efímero) viaja SOLO en cookie httpOnly del admin;
 * al cliente solo llegan user_code + verification_uri.
 */

const DEVICE_COOKIE = 'outlook_device_code'

export async function startOutlookLink(): Promise<
  | { userCode: string; verificationUri: string; interval: number }
  | { error: string }
> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  if (!getMicrosoftClientId()) {
    return {
      error:
        'Falta configurar la aplicación de Microsoft (MICROSOFT_CLIENT_ID). Pídele al agente la guía de alta.',
    }
  }

  const result = await requestDeviceCode()
  if ('error' in result) return { error: result.error }

  const cookieStore = await cookies()
  cookieStore.set(DEVICE_COOKIE, result.data.deviceCode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: result.data.expiresIn,
    path: '/',
  })

  return {
    userCode: result.data.userCode,
    verificationUri: result.data.verificationUri,
    interval: result.data.interval,
  }
}

export async function pollOutlookLink(): Promise<{
  status: 'connected' | 'pending' | 'slow_down' | 'expired' | 'declined' | 'error'
  email?: string
  error?: string
}> {
  const session = await getSession()
  if (!session) return { status: 'error', error: 'No autenticado' }

  const cookieStore = await cookies()
  const deviceCode = cookieStore.get(DEVICE_COOKIE)?.value
  if (!deviceCode) return { status: 'expired' }

  const result = await redeemDeviceCode(deviceCode)

  if (result.status === 'connected') {
    cookieStore.delete(DEVICE_COOKIE)
    revalidatePath('/settings')
    return { status: 'connected', email: result.email }
  }
  if (result.status === 'expired' || result.status === 'declined') {
    cookieStore.delete(DEVICE_COOKIE)
  }
  if (result.status === 'error') {
    return { status: 'error', error: result.error }
  }
  return { status: result.status }
}

export async function getOutlookCalendars(): Promise<
  { calendars: OutlookCalendar[] } | { error: string }
> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }
  return listOutlookCalendars()
}

const calendarChoice = z.object({
  id: z.string().min(1).max(1000),
  name: z.string().trim().min(1).max(300),
})

export async function chooseOutlookCalendar(
  id: string,
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const parsed = calendarChoice.safeParse({ id, name })
  if (!parsed.success) return { error: 'Calendario inválido' }

  await setOutlookCalendar(parsed.data.id, parsed.data.name)
  revalidatePath('/settings')
  return { success: true }
}

export async function disconnectOutlook(): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  await deleteOutlookConnection()
  const cookieStore = await cookies()
  cookieStore.delete(DEVICE_COOKIE)
  revalidatePath('/settings')
  return { success: true }
}
