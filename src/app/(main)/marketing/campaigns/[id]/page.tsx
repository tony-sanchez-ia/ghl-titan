import { notFound } from 'next/navigation'
import { getCampaign } from '@/features/marketing/services/queries'
import { listAllTags } from '@/features/contacts/services/contacts'
import { EmailBuilder } from '@/features/marketing/components/EmailBuilder'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [campaign, allTags] = await Promise.all([getCampaign(id), listAllTags()])
  if (!campaign) notFound()

  return <EmailBuilder campaign={campaign} allTags={allTags} />
}
