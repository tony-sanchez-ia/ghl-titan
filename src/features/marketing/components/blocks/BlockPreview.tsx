import { Code2, FileInput, ImageIcon, Play, Share2 } from 'lucide-react'
import { youtubeThumbnail } from '../../services/design'
import type { EmailBlock } from '@/types/database'

const TEXT_SIZES = {
  title: 'text-2xl font-bold leading-snug',
  subtitle: 'text-lg font-semibold leading-normal',
  normal: 'text-[15px] leading-relaxed',
} as const

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

/** Vista previa visual de un bloque dentro del lienzo del diseñador (espejo de render.ts). */
export function BlockPreview({ block, buttonColor }: { block: EmailBlock; buttonColor: string }) {
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
      if (c.html) {
        // HTML ya saneado (whitelist b/i/a/br): espejo del email real
        return (
          <div
            className={`px-8 py-3 break-words text-slate-900 ${TEXT_SIZES[c.size ?? 'normal']} ${align} [&_a]:text-[#2563eb] [&_a]:underline`}
            dangerouslySetInnerHTML={{ __html: c.html }}
          />
        )
      }
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
          <span
            className="inline-block rounded-lg px-7 py-3 text-[15px] font-semibold text-white"
            style={{ background: buttonColor }}
          >
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
    case 'social': {
      const nets = (c.networks ?? []).filter((n) => n.url)
      if (nets.length === 0) {
        return (
          <div className="px-8 py-4 text-center text-sm text-slate-400">
            <Share2 size={16} className="inline-block mr-1.5" />
            Añade tus redes sociales
          </div>
        )
      }
      return (
        <div className={`px-8 py-3.5 ${ALIGN[c.align ?? 'center']}`}>
          {nets.map((n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n.network} src={`/email/social/${n.network}.png`} alt={n.network} className="inline-block w-7 h-7 mx-[5px]" />
          ))}
        </div>
      )
    }
    case 'video': {
      if (!c.video_url) {
        return (
          <div className="px-8 py-4 text-center text-sm text-slate-400">
            <Play size={16} className="inline-block mr-1.5" />
            Pega el enlace de un vídeo (YouTube, Vimeo…)
          </div>
        )
      }
      const thumb = c.thumbnail_url || youtubeThumbnail(c.video_url)
      return (
        <div className={`px-8 py-3 ${ALIGN[c.align ?? 'center']}`}>
          {thumb ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="Vídeo" className="w-full rounded-lg" />
              <span className="mt-2 inline-block text-sm font-semibold" style={{ color: buttonColor }}>
                ▶&nbsp; Ver el vídeo
              </span>
            </>
          ) : (
            <span
              className="inline-block rounded-lg px-7 py-3 text-[15px] font-semibold text-white"
              style={{ background: buttonColor }}
            >
              ▶&nbsp; Ver el vídeo
            </span>
          )}
        </div>
      )
    }
    case 'form':
      if (!c.url || !c.label) {
        return (
          <div className="px-8 py-4 text-center text-sm text-slate-400">
            <FileInput size={16} className="inline-block mr-1.5" />
            Elige un formulario de captura
          </div>
        )
      }
      return (
        <div className={`px-8 py-4 ${ALIGN[c.align ?? 'center']}`}>
          <span
            className="inline-block rounded-lg px-7 py-3 text-[15px] font-semibold text-white"
            style={{ background: buttonColor }}
          >
            {c.label}
          </span>
        </div>
      )
    case 'html':
      if (!c.html) {
        return (
          <div className="px-8 py-4 text-center text-sm text-slate-400">
            <Code2 size={16} className="inline-block mr-1.5" />
            Pega tu código HTML (avanzado)
          </div>
        )
      }
      // aislado en iframe sandbox: su CSS/HTML no puede romper el editor
      return (
        <div className="px-8 py-1">
          <iframe
            sandbox=""
            srcDoc={`<body style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#0f172a">${c.html}</body>`}
            className="w-full border-0 pointer-events-none"
            style={{ height: 120 }}
            title="Vista previa del HTML"
          />
        </div>
      )
  }
}
