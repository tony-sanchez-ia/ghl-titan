import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getResend, EMAIL_FROM, EMAIL_ADMIN } from '@/lib/email/client'
import type { Booking, Calendar } from '@/types/database'

const TZ = 'Europe/Madrid'

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
        <h1 style="margin:0 0 4px;font-size:20px">GHL <span style="color:#2563eb">Titan</span></h1>
        <h2 style="margin:16px 0 12px;font-size:18px">${title}</h2>
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Enviado por GHL Titan</p>
    </div>
  </body></html>`
}

function fmt(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "EEEE d 'de' MMMM, HH:mm'h'", { locale: es })
}

function locationLine(b: Pick<Booking, 'location_type' | 'location_value'>): string {
  if (b.location_value) {
    const isLink = b.location_value.startsWith('http')
    const val = isLink
      ? `<a href="${b.location_value}" style="color:#2563eb">${b.location_value}</a>`
      : b.location_value
    return `<p style="margin:6px 0"><strong>Ubicación:</strong> ${val}</p>`
  }
  return `<p style="margin:6px 0;color:#64748b">Recibirás los detalles de conexión en breve.</p>`
}

interface BookingEmailData {
  booking: Pick<Booking, 'name' | 'email' | 'phone' | 'starts_at' | 'location_type' | 'location_value' | 'notes'>
  calendar: Pick<Calendar, 'name'>
}

/**
 * Envía emails tras una reserva:
 *  - Confirmación al prospecto (requiere dominio verificado en Resend para terceros).
 *  - Notificación al admin (funciona ya: el remitente onboarding@resend.dev puede escribir al dueño de la cuenta).
 * No lanza: si falla o no hay config, lo registra y sigue (la reserva no debe romperse por el email).
 */
export async function sendBookingEmails(data: BookingEmailData): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.info('[email] RESEND_API_KEY no configurada; se omite el envío.')
    return
  }

  const { booking, calendar } = data
  const when = fmt(booking.starts_at)

  // 1) Confirmación al prospecto
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: booking.email,
      subject: `Cita confirmada: ${calendar.name}`,
      html: shell('Tu cita está confirmada', `
        <p style="margin:6px 0">Hola ${booking.name},</p>
        <p style="margin:6px 0">Tu cita para <strong>${calendar.name}</strong> ha quedado reservada.</p>
        <p style="margin:6px 0"><strong>Cuándo:</strong> ${when} (hora peninsular)</p>
        ${locationLine(booking)}
        <p style="margin:16px 0 0;color:#64748b;font-size:14px">Si no puedes asistir, responde a este email para reprogramar.</p>
      `),
    })
  } catch (e) {
    console.error('[email] fallo enviando confirmación al prospecto:', (e as Error).message)
  }

  // 2) Notificación al admin
  if (EMAIL_ADMIN) {
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: EMAIL_ADMIN,
        subject: `Nueva cita: ${booking.name} — ${calendar.name}`,
        html: shell('Nueva reserva', `
          <p style="margin:6px 0"><strong>${booking.name}</strong> ha reservado <strong>${calendar.name}</strong>.</p>
          <p style="margin:6px 0"><strong>Cuándo:</strong> ${when}</p>
          <p style="margin:6px 0"><strong>Email:</strong> ${booking.email}</p>
          ${booking.phone ? `<p style="margin:6px 0"><strong>Teléfono:</strong> ${booking.phone}</p>` : ''}
          ${booking.notes ? `<p style="margin:6px 0"><strong>Notas:</strong> ${booking.notes}</p>` : ''}
        `),
      })
    } catch (e) {
      console.error('[email] fallo enviando notificación al admin:', (e as Error).message)
    }
  }
}
