import { aiAvailable } from '@/lib/ai/openrouter'
import { listFunnels } from '@/features/funnels/services/queries'
import { FunnelList } from '@/features/funnels/components/FunnelList'

export default async function FunnelsPage() {
  const funnels = await listFunnels()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Embudos</h1>
        <p className="mt-1 text-muted">
          Landing pages y embudos de venta, publicados en tus propios dominios.
        </p>
      </div>
      <FunnelList funnels={funnels} aiEnabled={aiAvailable()} />
    </div>
  )
}
