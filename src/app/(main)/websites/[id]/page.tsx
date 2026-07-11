import { notFound } from 'next/navigation'
import { getWebsite } from '@/features/websites/services/queries'
import { WebsiteDetail } from '@/features/websites/components/WebsiteDetail'

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const website = await getWebsite(id)
  if (!website) notFound()

  return <WebsiteDetail website={website} />
}
