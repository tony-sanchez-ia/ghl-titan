import { notFound } from 'next/navigation'
import { aiAvailable } from '@/lib/ai/openrouter'
import { listForms } from '@/features/automations/services/queries'
import { getWebsitePage } from '@/features/websites/services/queries'
import { WebsitePageBuilder } from '@/features/websites/components/WebsitePageBuilder'

export default async function WebsitePageEditorPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>
}) {
  const { id, pageId } = await params
  if (!/^[0-9a-f-]{36}$/.test(pageId)) notFound()
  const [data, forms] = await Promise.all([getWebsitePage(pageId), listForms()])
  if (!data || data.website.id !== id) notFound()

  return (
    <WebsitePageBuilder
      website={data.website}
      page={data.page}
      forms={forms}
      aiEnabled={aiAvailable()}
    />
  )
}
