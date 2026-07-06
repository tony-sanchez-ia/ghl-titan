import type { EmailBlock } from '@/types/database'

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** URLs reales del diseño (botones, links de imagen): para snapshot y validación anti open-redirect. */
export function extractDesignUrls(blocks: EmailBlock[]): string[] {
  const urls: string[] = []
  for (const b of blocks) {
    if (b.type === 'button' && b.config.url) urls.push(b.config.url)
    if (b.type === 'image' && b.config.link_url) urls.push(b.config.link_url)
  }
  return [...new Set(urls)]
}

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const TEXT_STYLES = {
  title: 'font-size:24px;font-weight:700;line-height:1.3',
  subtitle: 'font-size:18px;font-weight:600;line-height:1.4',
  normal: 'font-size:15px;font-weight:400;line-height:1.6',
} as const

/**
 * Bloques → HTML compatible con clientes de correo (tablas + estilos inline, 600px).
 * - `merge`: personalización de asunto/textos por destinatario.
 * - `unsubscribeUrl`: SIEMPRE se añade el pie legal con link de baja (null → texto sin link, para pruebas).
 * - `rewriteUrl`: reescritura de links para tracking (fase de envío); por defecto deja la URL tal cual.
 */
export function renderEmailHtml(opts: {
  blocks: EmailBlock[]
  merge: MergeData
  unsubscribeUrl: string | null
  rewriteUrl?: (url: string) => string
}): string {
  const { blocks, merge, unsubscribeUrl } = opts
  const rewrite = opts.rewriteUrl ?? ((u: string) => u)

  const rows = blocks.map((b) => {
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
        return `<td style="padding:24px 32px 8px;text-align:center;font-family:${FONT};color:#0f172a">${logo}${title}</td>`
      }
      case 'text': {
        const body = esc(applyMergeTags(c.text ?? '', merge)).replace(/\n/g, '<br>')
        return `<td style="padding:12px 32px;text-align:${align};font-family:${FONT};color:#0f172a;${TEXT_STYLES[c.size ?? 'normal']}">${body}</td>`
      }
      case 'image': {
        const img = `<img src="${esc(c.image_url ?? '')}" alt="${esc(c.alt ?? '')}" width="536" style="width:100%;max-width:536px;height:auto;display:inline-block;border:0;border-radius:8px">`
        const inner = c.link_url
          ? `<a href="${esc(rewrite(c.link_url))}" target="_blank">${img}</a>`
          : img
        return c.image_url ? `<td style="padding:12px 32px;text-align:${align}">${inner}</td>` : ''
      }
      case 'button': {
        if (!c.url || !c.label) return ''
        return `<td style="padding:16px 32px;text-align:${align}">
          <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr>
            <td style="background:#2563eb;border-radius:8px">
              <a href="${esc(rewrite(c.url))}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(c.label)}</a>
            </td>
          </tr></table>
        </td>`
      }
      case 'divider':
        return `<td style="padding:16px 32px"><div style="border-top:1px solid #e2e8f0;font-size:0;line-height:0">&nbsp;</div></td>`
      case 'spacer':
        return `<td style="font-size:0;line-height:0;height:${Math.min(Math.max(c.height ?? 24, 4), 160)}px">&nbsp;</td>`
      case 'footer': {
        const body = c.footer_text
          ? esc(applyMergeTags(c.footer_text, merge)).replace(/\n/g, '<br>')
          : ''
        return body
          ? `<td style="padding:20px 32px 4px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b">${body}</td>`
          : ''
      }
    }
  })

  const unsubscribe = unsubscribeUrl
    ? `<a href="${esc(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline">Darse de baja</a>`
    : '<span style="color:#94a3b8">Darse de baja</span>'

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px">
        ${rows.filter(Boolean).map((td) => `<tr>${td}</tr>`).join('\n')}
        <tr><td style="height:24px;font-size:0;line-height:0">&nbsp;</td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
        <tr><td style="padding:16px 8px;text-align:center;font-family:${FONT};font-size:12px;color:#94a3b8">
          Recibes este email porque estás en nuestra lista de contactos. · ${unsubscribe}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
