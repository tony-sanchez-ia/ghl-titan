import { Resend } from 'resend'

/** Cliente Resend. Devuelve null si no hay API key configurada. Solo servidor. */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'GHL Titan <onboarding@resend.dev>'
export const EMAIL_ADMIN = process.env.EMAIL_ADMIN ?? null
