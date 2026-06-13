'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { deleteContact } from '@/actions/contacts'

export function DeleteContactButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await deleteContact(id)
    if (res?.error) {
      setLoading(false)
      alert(res.error)
      return
    }
    router.push('/contacts')
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">¿Seguro?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Borrando...' : 'Sí, borrar'}
        </button>
        <button onClick={() => setConfirming(false)} className={`${ui.button} px-3 py-2 text-sm`}>
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`${ui.button} px-3 py-2 text-sm text-red-600`}
    >
      <Trash2 size={16} /> Borrar
    </button>
  )
}
