import { notFound } from 'next/navigation'
import { getCampaign } from '@/features/marketing/services/queries'
import { listAllTags } from '@/features/contacts/services/contacts'
import { listForms } from '@/features/automations/services/queries'
import { EmailBuilder } from '@/features/marketing/components/EmailBuilder'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [campaign, allTags, forms] = await Promise.all([getCampaign(id), listAllTags(), listForms()])
  if (!campaign) notFound()

  return <EmailBuilder campaign={campaign} allTags={allTags} forms={forms} />
}
