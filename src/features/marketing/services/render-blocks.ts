import type { EmailBlock } from '@/types/database'
import { youtubeThumbnail } from './design'
import { rewriteHtmlUrls } from './sanitize'

/** Datos de personalización de un destinatario. */
export interface MergeData {
  nombre?: string
  apellido?: string
  email?: string
}

const MERGE_TAGS: Record<keyof MergeData, RegExp> = {
  nombre: /\{\{\s*nombre\s*\}\}/gi,
  apellido: /\{\{\s*apellido\s*\}\}/gi,
  email: /\{\{\s*email\s*\}\}/gi,
}

/** Sustituye {{nombre}} {{apellido}} {{email}} con fallback vacío y limpia restos ("Hola ," → "Hola,"). */
export function applyMergeTags(text: string, data: MergeData): string {
  let out = text
  for (const key of Object.keys(MERGE_TAGS) as (keyof MergeData)[]) {
    out = out.replace(MERGE_TAGS[key], data[key]?.trim() ?? '')
  }
  return out.replace(/[ \t]+([,.;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ')
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const TEXT_STYLES = {
  title: 'font-size:24px;font-weight:700;line-height:1.3',
  subtitle: 'font-size:18px;font-weight:600;line-height:1.4',
  normal: 'font-size:15px;font-weight:400;line-height:1.6',
} as const

/** Contexto de render de un bloque dentro de una columna. */
export interface BlockRenderCtx {
  merge: MergeData
  rewrite: (url: string) => string
  buttonColor: string
  pad: number // padding horizontal en px (32 a ancho completo, 16 en columnas)
  siteUrl: string // base absoluta para assets propios (iconos de redes)
}

/** Bloque → `<td>…</td>` email-safe (estilos inline, sin flexbox/grid). */
export function renderBlockTd(b: EmailBlock, ctx: BlockRenderCtx): string {
  const { merge, rewrite, buttonColor, pad, siteUrl } = ctx
  const c = b.config
  const align = c.align ?? 'left'
  switch (b.type) {
    case 'header': {
      const logo = c.logo_url
        ? `<img src="${esc(c.logo_url)}" alt="" height="40" style="height:40px;display:inline-block;border:0">`
        : ''
      const title = c.title
        ? `<div style="font-size:20px;font-weight:700;margin-top:${c.logo_url ? '10px' : '0'}">${esc(c.title)}</div>`
        : ''
      return `<td style="padding:24px ${pad}px 8px;text-align:center;font-family:${FONT};color:#0f172a">${logo}${title}</td>`
    }
    case 'text': {
      // dos rutas: HTML con formato (V2, YA saneado en servidor) vs texto plano legado (se escapa)
      const body = c.html
        ? rewriteHtmlUrls(applyMergeTags(c.html, merge), rewrite)
        : esc(applyMergeTags(c.text ?? '', merge)).replace(/\n/g, '<br>')
      return `<td style="padding:12px ${pad}px;text-align:${align};font-family:${FONT};color:#0f172a;${TEXT_STYLES[c.size ?? 'normal']}">${body}</td>`
    }
    case 'image': {
      const img = `<img src="${esc(c.image_url ?? '')}" alt="${esc(c.alt ?? '')}" width="536" style="width:100%;max-width:536px;height:auto;display:inline-block;border:0;border-radius:8px">`
      const inner = c.link_url
        ? `<a href="${esc(rewrite(c.link_url))}" target="_blank">${img}</a>`
        : img
      return c.image_url ? `<td style="padding:12px ${pad}px;text-align:${align}">${inner}</td>` : ''
    }
    case 'button': {
      if (!c.url || !c.label) return ''
      return `<td style="padding:16px ${pad}px;text-align:${align}">
        <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr>
          <td style="background:${esc(buttonColor)};border-radius:8px">
            <a href="${esc(rewrite(c.url))}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(c.label)}</a>
          </td>
        </tr></table>
      </td>`
    }
    case 'divider':
      return `<td style="padding:16px ${pad}px"><div style="border-top:1px solid #e2e8f0;font-size:0;line-height:0">&nbsp;</div></td>`
    case 'spacer':
      return `<td style="font-size:0;line-height:0;height:${Math.min(Math.max(c.height ?? 24, 4), 160)}px">&nbsp;</td>`
    case 'footer': {
      const body = c.footer_text
        ? esc(applyMergeTags(c.footer_text, merge)).replace(/\n/g, '<br>')
        : ''
      return body
        ? `<td style="padding:20px ${pad}px 4px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b">${body}</td>`
        : ''
    }
    case 'social': {
      const nets = (c.networks ?? []).filter((n) => n.url)
      if (nets.length === 0) return ''
      const icons = nets
        .map(
          (n) =>
            `<a href="${esc(rewrite(n.url))}" target="_blank" style="text-decoration:none"><img src="${esc(siteUrl)}/email/social/${n.network}.png" alt="${n.network}" width="28" height="28" style="width:28px;height:28px;border:0;display:inline-block;margin:0 5px"></a>`
        )
        .join('')
      return `<td style="padding:14px ${pad}px;text-align:${c.align ?? 'center'};font-size:0;line-height:0">${icons}</td>`
    }
    case 'video': {
      if (!c.video_url) return ''
      const thumb = c.thumbnail_url || youtubeThumbnail(c.video_url)
      const href = esc(rewrite(c.video_url))
      if (!thumb) {
        // sin miniatura: botón "ver vídeo"
        return `<td style="padding:16px ${pad}px;text-align:${c.align ?? 'center'}">
          <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;background:${esc(buttonColor)};border-radius:8px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">▶&nbsp; Ver el vídeo</a>
        </td>`
      }
      return `<td style="padding:12px ${pad}px;text-align:${c.align ?? 'center'}">
        <a href="${href}" target="_blank" style="text-decoration:none">
          <img src="${esc(thumb)}" alt="${esc(c.alt ?? 'Vídeo')}" width="536" style="width:100%;max-width:536px;height:auto;display:block;border:0;border-radius:8px">
          <span style="display:block;margin-top:8px;font-family:${FONT};font-size:14px;font-weight:600;color:${esc(buttonColor)}">▶&nbsp; Ver el vídeo</span>
        </a>
      </td>`
    }
    case 'form': {
      if (!c.url || !c.label) return ''
      return `<td style="padding:16px ${pad}px;text-align:${c.align ?? 'center'}">
        <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr>
          <td style="background:${esc(buttonColor)};border-radius:8px">
            <a href="${esc(rewrite(c.url))}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(c.label)}</a>
          </td>
        </tr></table>
      </td>`
    }
    case 'html': {
      // saneado básico en servidor al guardar; sus links NO trackean (decisión PRP-008)
      return c.html ? `<td style="padding:4px ${pad}px;font-family:${FONT};font-size:15px;color:#0f172a">${c.html}</td>` : ''
    }
  }
  return ''
}
