import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { queryOne } from '@/lib/db'
import type { Contact } from '@/types/database'
import { UnsubscribeCard } from '@/features/marketing/components/UnsubscribeCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Baja de emails' }

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{32}$/.test(token)) notFound()
  const contact = await queryOne<Contact>(`select * from contacts where unsubscribe_token = $1`, [token])
  if (!contact) notFound()

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">
        <UnsubscribeCard
          token={token}
          email={contact.email ?? ''}
          alreadyUnsubscribed={contact.unsubscribed_at !== null}
        />
        <p className="text-center text-xs text-muted mt-6">Powered by GHL Titan</p>
      </div>
    </div>
  )
}
