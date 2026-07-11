import { aiAvailable } from '@/lib/ai/openrouter'
import { listWebsites } from '@/features/websites/services/queries'
import { WebsiteList } from '@/features/websites/components/WebsiteList'
import { CreateWebsiteDialog } from '@/features/websites/components/CreateWebsiteDialog'

export default async function WebsitesPage() {
  const websites = await listWebsites()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sitios web</h1>
          <p className="mt-1 text-muted">
            Webs con varias páginas en tu propio dominio: la agencia, una división, un producto.
          </p>
        </div>
        <CreateWebsiteDialog aiEnabled={aiAvailable()} />
      </div>

      <WebsiteList websites={websites} />
    </div>
  )
}
