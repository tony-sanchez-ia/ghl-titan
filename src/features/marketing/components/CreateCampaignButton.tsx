'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createCampaign } from '@/actions/marketing'

export function CreateCampaignButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true)
    const res = await createCampaign()
    if (res.error || !res.id) {
      setBusy(false)
      alert(res.error ?? 'No se pudo crear la campaña')
      return
    }
    router.push(`/marketing/campaigns/${res.id}`)
  }

  return (
    <button onClick={onCreate} disabled={busy} className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
      <Plus size={16} /> Crear campaña
    </button>
  )
}
