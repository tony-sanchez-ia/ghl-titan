'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ui } from '@/shared/lib/ui'
import { deleteCalendar } from '@/actions/calendars'

export function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/book/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={copy} className={`${ui.button} px-3 py-2 text-sm`}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copiado' : 'Copiar enlace'}
      </button>
      <Link href={`/book/${slug}`} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
        <ExternalLink size={16} /> Abrir
      </Link>
    </div>
  )
}

export function DeleteCalendarButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await deleteCalendar(id)
    if (res?.error) {
      setLoading(false)
      alert(res.error)
      return
    }
    router.push('/calendars')
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">¿Borrar calendario y sus citas?</span>
        <button onClick={handleDelete} disabled={loading} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
          {loading ? 'Borrando...' : 'Sí, borrar'}
        </button>
        <button onClick={() => setConfirming(false)} className={`${ui.button} px-3 py-2 text-sm`}>No</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className={`${ui.button} px-3 py-2 text-sm text-red-600`}>
      <Trash2 size={16} /> Borrar
    </button>
  )
}
