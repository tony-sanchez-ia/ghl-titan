'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createCampaignFromTemplate, deleteTemplate } from '@/actions/marketing'
import { allBlocks, migrateDesign } from '../services/design'
import type { EmailTemplate } from '@/types/database'

export function TemplateList({ templates }: { templates: EmailTemplate[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function onUse(id: string) {
    setBusy(id)
    const res = await createCampaignFromTemplate(id)
    if (res.error || !res.id) {
      setBusy(null)
      alert(res.error ?? 'No se pudo crear la campaña')
      return
    }
    router.push(`/marketing/campaigns/${res.id}`)
  }

  async function onDelete(id: string) {
    if (!confirm('¿Borrar esta plantilla?')) return
    const res = await deleteTemplate(id)
    if (res.error) return alert(res.error)
    router.refresh()
  }

  if (templates.length === 0) {
    return (
      <div className={`${ui.card} p-8 text-center text-muted`}>
        Aún no tienes plantillas. Diseña una campaña y usa «Guardar como plantilla».
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((t) => (
        <div key={t.id} className={`${ui.card} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold truncate inline-flex items-center gap-2">
              <LayoutTemplate size={16} className="text-muted shrink-0" /> {t.name}
            </h3>
            <button
              onClick={() => onDelete(t.id)}
              className="text-muted hover:text-red-600 transition-colors"
              title="Borrar plantilla"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <p className="text-sm text-muted mt-1">
            {allBlocks(migrateDesign(t.design)).length}{' '}
            {allBlocks(migrateDesign(t.design)).length === 1 ? 'bloque' : 'bloques'}
          </p>
          <button
            onClick={() => onUse(t.id)}
            disabled={busy !== null}
            className={`${ui.button} px-3 py-2 text-sm mt-3`}
          >
            <Plus size={16} /> Crear campaña con esta plantilla
          </button>
        </div>
      ))}
    </div>
  )
}
