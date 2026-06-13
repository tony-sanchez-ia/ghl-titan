'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, Upload, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { ui } from '@/shared/lib/ui'

interface Props {
  tags: string[]
  onImportClick: () => void
}

export function ContactsToolbar({ tags, onImportClick }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const activeTag = searchParams.get('tag') ?? ''

  function updateParams(next: { q?: string; tag?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q)
      else params.delete('q')
    }
    if (next.tag !== undefined) {
      if (next.tag) params.set('tag', next.tag)
      else params.delete('tag')
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              updateParams({ q: e.target.value })
            }}
            placeholder="Buscar por nombre, email o teléfono..."
            className={`${ui.input} pl-9`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={activeTag}
          onChange={(e) => updateParams({ tag: e.target.value })}
          className={`${ui.input} w-auto`}
        >
          <option value="">Todos los tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {activeTag && (
          <button
            onClick={() => updateParams({ tag: '' })}
            className={`${ui.button} px-2 py-2`}
            aria-label="Quitar filtro"
          >
            <X size={16} />
          </button>
        )}

        <button onClick={onImportClick} className={`${ui.button} px-3 py-2 text-sm`}>
          <Upload size={16} /> Importar
        </button>

        <Link href="/contacts/new" className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
          <Plus size={16} /> Nuevo
        </Link>
      </div>
    </div>
  )
}
