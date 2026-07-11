'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Link2, MonitorSmartphone, SquareMousePointer } from 'lucide-react'
import { ui } from '@/shared/lib/ui'

type Mode = 'link' | 'inline' | 'popup'
type Trigger = 'load' | 'delay' | 'scroll'

/** Pestaña "Integrar": enlace directo, iframe inline (auto-alto) y popup emergente. */
export function IntegratePanel({
  slug,
  siteUrl,
  published,
}: {
  slug: string
  siteUrl: string
  published: boolean
}) {
  const [mode, setMode] = useState<Mode>('link')
  const [trigger, setTrigger] = useState<Trigger>('load')
  const [delay, setDelay] = useState(5)
  const [scroll, setScroll] = useState(50)

  // Origen real en cliente si no hay SITE_URL (useEffect evita mismatch de hidratación).
  const [base, setBase] = useState(siteUrl)
  useEffect(() => {
    if (!siteUrl && typeof window !== 'undefined') setBase(window.location.origin)
  }, [siteUrl])

  const publicUrl = `${base}/form/${slug}`

  const inlineSnippet =
    `<div data-titan-form="${slug}"></div>\n` +
    `<script src="${base}/titan-forms.js" async></script>`

  const popupAttrs = [
    `data-titan-form="${slug}"`,
    `data-titan-popup="1"`,
    trigger !== 'load' ? `data-titan-trigger="${trigger}"` : '',
    trigger === 'delay' ? `data-titan-delay="${delay}"` : '',
    trigger === 'scroll' ? `data-titan-scroll="${scroll}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const popupSnippet = `<script src="${base}/titan-forms.js" ${popupAttrs} async></script>`

  return (
    <div className="max-w-2xl space-y-5">
      {!published && (
        <div className={`${ui.card} p-3 text-sm text-amber-700 bg-amber-50 border-amber-200`}>
          El formulario está en borrador. El código funcionará en cuanto lo publiques.
        </div>
      )}

      <div className="flex gap-2">
        <ModeTab active={mode === 'link'} onClick={() => setMode('link')} icon={<Link2 size={15} />} label="Enlace directo" />
        <ModeTab active={mode === 'inline'} onClick={() => setMode('inline')} icon={<MonitorSmartphone size={15} />} label="Insertar en la web" />
        <ModeTab active={mode === 'popup'} onClick={() => setMode('popup')} icon={<SquareMousePointer size={15} />} label="Ventana emergente" />
      </div>

      {mode === 'link' && (
        <Snippet
          title="Enlace público"
          hint="Compártelo por email, redes o WhatsApp. Abre el formulario como página propia."
          code={publicUrl}
        />
      )}

      {mode === 'inline' && (
        <Snippet
          title="Insertar en tu web (iframe que se autoajusta de alto)"
          hint="Pega este código donde quieras que aparezca el formulario dentro de tu página."
          code={inlineSnippet}
        />
      )}

      {mode === 'popup' && (
        <div className="space-y-4">
          <div className={`${ui.card} p-4 space-y-3`}>
            <h4 className="text-sm font-semibold">¿Cuándo se abre el popup?</h4>
            <div className="flex flex-wrap gap-2">
              <TriggerTab active={trigger === 'load'} onClick={() => setTrigger('load')} label="Al cargar" />
              <TriggerTab active={trigger === 'delay'} onClick={() => setTrigger('delay')} label="Tras unos segundos" />
              <TriggerTab active={trigger === 'scroll'} onClick={() => setTrigger('scroll')} label="Al hacer scroll" />
            </div>
            {trigger === 'delay' && (
              <label className="flex items-center gap-2 text-sm">
                Abrir tras
                <input type="number" min={1} max={120} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className={`${ui.input} w-20 text-sm`} />
                segundos
              </label>
            )}
            {trigger === 'scroll' && (
              <label className="flex items-center gap-2 text-sm">
                Abrir al desplazar el
                <input type="number" min={5} max={100} value={scroll} onChange={(e) => setScroll(Number(e.target.value))} className={`${ui.input} w-20 text-sm`} />%
              </label>
            )}
          </div>
          <Snippet
            title="Código del popup"
            hint="Pégalo antes de cerrar </body>. También puedes abrirlo desde un botón con data-titan-form-open."
            code={popupSnippet}
          />
          <Snippet
            title="Abrir el popup desde un botón (opcional)"
            hint="Añade este atributo a cualquier botón o enlace de tu web."
            code={`<button data-titan-form-open="${slug}">Contactar</button>`}
          />
        </div>
      )}
    </div>
  )
}

function ModeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:bg-bg'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function TriggerTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:bg-bg'
      }`}
    >
      {label}
    </button>
  )
}

function Snippet({ title, hint, code }: { title: string; hint: string; code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      // navigator.clipboard solo existe en contexto seguro (gotcha LAN por http://IP)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* si el navegador lo bloquea, el usuario puede copiar a mano */
    }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <button onClick={copy} className={`${ui.button} px-2.5 py-1.5 text-xs`}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="rounded-lg border border-border bg-bg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  )
}
