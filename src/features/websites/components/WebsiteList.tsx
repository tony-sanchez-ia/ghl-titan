'use client'

import Link from 'next/link'
import { Globe } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import type { WebsiteListItem } from '../services/queries'

const STATUS_LABEL = { draft: 'Borrador', published: 'Publicado' } as const

export function WebsiteList({ websites }: { websites: WebsiteListItem[] }) {
  if (websites.length === 0) {
    return (
      <div className={`${ui.card} p-10 text-center text-muted`}>
        <Globe size={28} className="mx-auto mb-3 opacity-60" />
        <p className="font-medium text-fg">Todavía no hay sitios web</p>
        <p className="text-sm mt-1">
          Crea tu primer sitio: la web de tu agencia, una división, o una web temporal de producto.
        </p>
      </div>
    )
  }

  return (
    <div className={`${ui.card} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="py-3 px-4 font-medium">Nombre</th>
            <th className="py-3 px-4 font-medium">Estado</th>
            <th className="py-3 px-4 font-medium">Páginas</th>
            <th className="py-3 px-4 font-medium">Dominios</th>
            <th className="py-3 px-4 font-medium">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {websites.map((w) => (
            <tr key={w.id} className="border-b border-border last:border-0 hover:bg-bg">
              <td className="py-3 px-4">
                <Link href={`/websites/${w.id}`} className="font-medium text-primary hover:underline">
                  {w.name}
                </Link>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    w.status === 'published'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-bg text-muted'
                  }`}
                >
                  {STATUS_LABEL[w.status]}
                </span>
              </td>
              <td className="py-3 px-4">{w.pageCount}</td>
              <td className="py-3 px-4 text-muted">
                {w.hostnames.length > 0 ? w.hostnames.join(', ') : '—'}
              </td>
              <td className="py-3 px-4 text-muted">
                {new Date(w.updated_at).toLocaleDateString('es-ES')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
