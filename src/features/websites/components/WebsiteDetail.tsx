'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, Copy, ExternalLink, Globe, Home, Pencil, Plus, Trash2,
} from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { copyText } from '@/shared/lib/clipboard'
import {
  addWebsiteDomain, createWebsitePage, deleteWebsite, deleteWebsitePage, removeWebsiteDomain,
  renameWebsite, renameWebsitePage, setWebsiteHomePage, setWebsiteStatus, updateWebsiteSettings,
} from '@/actions/websites'
import type { WebsiteWithContent } from '../services/queries'

export function WebsiteDetail({ website }: { website: WebsiteWithContent }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(website.name)
  const published = website.status === 'published'
  const previewBase = `/w/${website.slug}`

  async function run(fn: () => Promise<{ error?: string } | void>) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res && 'error' in res && res.error) return alert(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Link href="/websites" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Sitios web
      </Link>

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== website.name && run(() => renameWebsite(website.id, name))}
          className="text-2xl font-bold bg-transparent outline-none focus:bg-bg rounded px-1 min-w-40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              published
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-bg text-muted'
            }`}
          >
            {published ? 'Publicado' : 'Borrador'}
          </span>
          <button
            onClick={() => run(() => setWebsiteStatus(website.id, published ? 'draft' : 'published'))}
            disabled={busy}
            className={`${published ? ui.button : ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}
          >
            {published ? 'Despublicar' : 'Publicar sitio'}
          </button>
          {published && (
            <a href={previewBase} target="_blank" className={`${ui.button} px-3 py-2 text-sm`}>
              <ExternalLink size={15} /> Ver sitio
            </a>
          )}
          <button
            onClick={() => {
              if (!confirm('¿Borrar el sitio y todas sus páginas?')) return
              void deleteWebsite(website.id).then(() => router.push('/websites'))
            }}
            disabled={busy}
            className={`${ui.button} px-3 py-2 text-sm text-red-600`}
            title="Borrar sitio"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!published && (
        <div className={`${ui.card} p-3 text-sm text-muted`}>
          El sitio está en borrador: no es visible al público (ni en el dominio) hasta que lo publiques.
        </div>
      )}

      {/* Páginas */}
      <PagesGrid website={website} busy={busy} run={run} previewBase={previewBase} />

      {/* Dominios */}
      <DomainsCard website={website} busy={busy} run={run} />

      {/* Identidad y seguimiento */}
      <SettingsCard website={website} />
    </div>
  )
}

// ─── Páginas ─────────────────────────────────────────────────────────────────

function PagesGrid({
  website, busy, run, previewBase,
}: {
  website: WebsiteWithContent
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
  previewBase: string
}) {
  const router = useRouter()
  const published = website.status === 'published'

  async function onAddPage() {
    const name = prompt('Nombre de la página (p. ej. Contacto):')
    if (!name?.trim()) return
    const res = await createWebsitePage(website.id, name.trim())
    if (res.error) return alert(res.error)
    if (res.id) router.push(`/websites/${website.id}/pages/${res.id}`)
  }

  return (
    <div className={`${ui.card} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Páginas ({website.pages.length})</h2>
          <p className="text-sm text-muted mt-0.5">
            La página de inicio se sirve en la raíz del dominio; el resto en /su-enlace.
          </p>
        </div>
        <button onClick={onAddPage} className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
          <Plus size={15} /> Añadir página
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {website.pages.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium truncate">
                {p.name}
                {p.is_home && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                    <Home size={12} /> Inicio
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                {!p.is_home && (
                  <button
                    onClick={() => run(() => setWebsiteHomePage(p.id))}
                    disabled={busy}
                    className="text-muted hover:text-primary p-1"
                    title="Hacer página de inicio"
                  >
                    <Home size={14} />
                  </button>
                )}
                <button
                  onClick={async () => {
                    const name = prompt('Nuevo nombre de la página:', p.name)
                    if (name?.trim()) run(() => renameWebsitePage(p.id, name.trim()))
                  }}
                  disabled={busy}
                  className="text-muted hover:text-fg p-1"
                  title="Renombrar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`¿Borrar la página "${p.name}"?`)) return
                    run(() => deleteWebsitePage(p.id))
                  }}
                  disabled={busy}
                  className="text-muted hover:text-red-600 p-1"
                  title="Borrar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted font-mono">/{p.is_home ? '' : p.slug}</p>
            <div className="flex gap-2 pt-1">
              <Link
                href={`/websites/${website.id}/pages/${p.id}`}
                className={`${ui.buttonPrimary} flex-1 justify-center px-3 py-1.5 text-sm`}
              >
                Editar
              </Link>
              {published && (
                <a
                  href={p.is_home ? previewBase : `${previewBase}/${p.slug}`}
                  target="_blank"
                  className={`${ui.button} px-2.5 py-1.5 text-sm`}
                  title="Ver página"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dominios ────────────────────────────────────────────────────────────────

function DomainsCard({
  website, busy, run,
}: {
  website: WebsiteWithContent
  busy: boolean
  run: (fn: () => Promise<{ error?: string } | void>) => void
}) {
  const [hostname, setHostname] = useState('')
  const [copied, setCopied] = useState(false)

  return (
    <div className={`${ui.card} p-5 space-y-4`}>
      <div>
        <h2 className="font-semibold inline-flex items-center gap-2">
          <Globe size={16} className="text-primary" /> Dominio propio
        </h2>
        <p className="text-sm text-muted mt-0.5">
          Apunta tu dominio a este sitio. Falta el alta del dominio en el servidor (EasyPanel) y el
          DNS — está explicado en la guía de despliegue.
        </p>
      </div>

      {website.domains.length > 0 && (
        <ul className="space-y-2">
          {website.domains.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="font-mono text-sm">{d.hostname}</span>
              <button
                onClick={() => run(() => removeWebsiteDomain(d.id))}
                disabled={busy}
                className="text-muted hover:text-red-600 p-1"
                title="Quitar dominio"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="www.tunegocio.com"
          className={`${ui.input} max-w-xs`}
        />
        <button
          onClick={() => {
            if (!hostname.trim()) return
            run(() => addWebsiteDomain(website.id, hostname))
            setHostname('')
          }}
          disabled={busy}
          className={`${ui.button} px-3 py-2 text-sm disabled:opacity-50`}
        >
          <Plus size={14} /> Añadir
        </button>
      </div>

      {website.status === 'published' && (
        <button
          onClick={async () => {
            if (await copyText(`${window.location.origin}/w/${website.slug}`)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }
          }}
          className={`${ui.button} px-3 py-1.5 text-xs`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} Copiar enlace de vista previa
        </button>
      )}
    </div>
  )
}

// ─── Identidad y seguimiento ─────────────────────────────────────────────────

function SettingsCard({ website }: { website: WebsiteWithContent }) {
  const router = useRouter()
  const [favicon, setFavicon] = useState(website.favicon_url ?? '')
  const [headScripts, setHeadScripts] = useState(website.head_scripts ?? '')
  const [bodyScripts, setBodyScripts] = useState(website.body_scripts ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    setMsg(null)
    setError(null)
    const res = await updateWebsiteSettings(website.id, {
      favicon_url: favicon.trim(),
      head_scripts: headScripts,
      body_scripts: bodyScripts,
    })
    setSaving(false)
    if (res.error) setError(res.error)
    else {
      setMsg('Guardado')
      router.refresh()
    }
  }

  return (
    <div className={`${ui.card} p-5 space-y-4 max-w-2xl`}>
      <div>
        <h2 className="font-semibold">Identidad y seguimiento</h2>
        <p className="text-sm text-muted mt-0.5">
          Favicon del sitio y scripts de analítica (Google Analytics, Pixel…) que se cargan en
          todas las páginas.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">URL del favicon</label>
        <input
          value={favicon}
          onChange={(e) => setFavicon(e.target.value)}
          placeholder="https://…/favicon.png"
          className={ui.input}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Scripts del encabezado (&lt;head&gt;)</label>
        <textarea
          value={headScripts}
          onChange={(e) => setHeadScripts(e.target.value)}
          rows={4}
          placeholder="<script>…</script> (Google Analytics, Tag Manager…)"
          className={`${ui.input} font-mono text-xs`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Scripts del cuerpo (final de &lt;body&gt;)</label>
        <textarea
          value={bodyScripts}
          onChange={(e) => setBodyScripts(e.target.value)}
          rows={4}
          placeholder="<script>…</script> (Facebook Pixel, chats…)"
          className={`${ui.input} font-mono text-xs`}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <button onClick={onSave} disabled={saving} className={`${ui.buttonPrimary} px-4 py-2 text-sm disabled:opacity-50`}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
