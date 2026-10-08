import { NextResponse } from 'next/server'
import { processDueEmails } from '@/features/automations/services/email-engine'
import { processEnrollments } from '@/features/automations/services/engine'
import { processCampaigns } from '@/features/marketing/services/campaign-engine'
import { rememberNextDue, shouldProcess } from '@/features/automations/services/cron-gate'

export const dynamic = 'force-dynamic'

/**
 * Avanza los workflows (esperas vencidas + ramas expiradas) y envía los
 * emails programados vencidos. Protegido por token.
 * Configúralo en un cron (Vercel Cron, n8n, cron-job.org...):
 *   GET /api/cron/process-emails?token=CRON_SECRET
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const secret = process.env.CRON_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Sin actividad ni trabajo vencido: no tocar la BD para que Neon pueda dormirse
  if (!shouldProcess()) return NextResponse.json({ ok: true, skipped: true })
  const enrollments = await processEnrollments()
  const emails = await processDueEmails()
  const campaigns = await processCampaigns()
  await rememberNextDue()
  return NextResponse.json({ ok: true, enrollments: enrollments.processed, ...emails, campaigns })
}
