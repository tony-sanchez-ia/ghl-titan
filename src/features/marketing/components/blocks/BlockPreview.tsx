import { ImageIcon } from 'lucide-react'
import type { EmailBlock } from '@/types/database'

const TEXT_SIZES = {
  title: 'text-2xl font-bold leading-snug',
  subtitle: 'text-lg font-semibold leading-normal',
  normal: 'text-[15px] leading-relaxed',
} as const

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

/** Vista previa visual de un bloque dentro del lienzo del diseñador (espejo de render.ts). */
export function BlockPreview({ block }: { block: EmailBlock }) {
  const c = block.config
  const align = ALIGN[c.align ?? 'left']

  switch (block.type) {
    case 'header':
      return (
        <div className="px-8 pt-6 pb-2 text-center text-slate-900">
          {c.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo_url} alt="" className="h-10 inline-block" />
          ) : null}
          {c.title ? (
            <div className={`text-xl font-bold ${c.logo_url ? 'mt-2.5' : ''}`}>{c.title}</div>
          ) : null}
          {!c.logo_url && !c.title ? <span className="text-slate-400 text-sm">Cabecera vacía</span> : null}
        </div>
      )
    case 'text':
      return (
        <div className={`px-8 py-3 whitespace-pre-wrap break-words text-slate-900 ${TEXT_SIZES[c.size ?? 'normal']} ${align}`}>
          {c.text || <span className="text-slate-400">Escribe tu texto…</span>}
        </div>
      )
    case 'image':
      return (
        <div className={`px-8 py-3 ${align}`}>
          {c.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image_url} alt={c.alt ?? ''} className="inline-block w-full max-w-full rounded-lg" />
          ) : (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
              <ImageIcon size={22} className="inline-block mb-1" />
              <div>Añade la URL de una imagen</div>
            </div>
          )}
        </div>
      )
    case 'button':
      return (
        <div className={`px-8 py-4 ${align}`}>
          <span className="inline-block rounded-lg bg-[#2563eb] px-7 py-3 text-[15px] font-semibold text-white">
            {c.label || 'Botón sin texto'}
          </span>
        </div>
      )
    case 'divider':
      return (
        <div className="px-8 py-4">
          <div className="border-t border-slate-200" />
        </div>
      )
    case 'spacer':
      return <div style={{ height: Math.min(Math.max(c.height ?? 24, 4), 160) }} />
    case 'footer':
      return (
        <div className="px-8 pt-5 pb-1 text-center text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">
          {c.footer_text || <span className="text-slate-400">Datos del negocio…</span>}
        </div>
      )
  }
}
