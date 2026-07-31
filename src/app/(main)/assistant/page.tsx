import { listMemories } from '@/features/assistant/services/memory'
import { AssistantChat } from '@/features/assistant/components/AssistantChat'
import { MemoryPanel } from '@/features/assistant/components/MemoryPanel'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Asistente IA — GHL Titan' }

export default async function AssistantPage() {
  const memories = await listMemories()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Asistente IA</h1>
        <p className="text-muted text-sm mt-1">
          Tu copywriter: conoce tus contactos y campañas, escribe newsletters y crea borradores en Marketing.
        </p>
      </div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <AssistantChat />
        <MemoryPanel memories={memories} />
      </div>
    </div>
  )
}
