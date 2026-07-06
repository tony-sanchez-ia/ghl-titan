import type { EmailDesign, EmailSection } from '@/types/database'
import { allBlocks, LAYOUT_COLUMNS } from './design'
import { esc, FONT, renderBlockTd, type BlockRenderCtx, type MergeData } from './render-blocks'
import { extractHtmlUrls } from './sanitize'

export { applyMergeTags, type MergeData } from './render-blocks'

/**
 * URLs reales del diseño (para snapshot y validación anti open-redirect):
 * botones, links de imagen, formulario, vídeo, redes y enlaces del texto con formato.
 * Los links del bloque "Código HTML" NO entran (no trackean, decisión PRP-008).
 */
export function extractDesignUrls(design: EmailDesign): string[] {
  const urls: string[] = []
  for (const b of allBlocks(design)) {
    const c = b.config
    if (b.type === 'button' && c.url) urls.push(c.url)
    if (b.type === 'image' && c.link_url) urls.push(c.link_url)
    if (b.type === 'form' && c.url) urls.push(c.url)
    if (b.type === 'video' && c.video_url) urls.push(c.video_url)
    if (b.type === 'social') for (const n of c.networks ?? []) if (n.url) urls.push(n.url)
    if (b.type === 'text' && c.html) urls.push(...extractHtmlUrls(c.html))
  }
  return [...new Set(urls)]
}

/**
 * Sección → fila de la tabla del email. Columnas email-safe: celdas `inline-block`
 * con ancho % (apilan solas en clientes sin media queries estrechos) + media query
 * de refuerzo (clase .col) para Gmail/Apple Mail.
 */
function renderSection(section: EmailSection, ctx: BlockRenderCtx): string {
  const widths = LAYOUT_COLUMNS[section.layout]
  const cols = section.columns
    .map((blocks, i) => {
      const rows = blocks
        .map((b) => renderBlockTd(b, ctx))
        .filter(Boolean)
        .map((td) => `<tr>${td}</tr>`)
        .join('\n')
      return `<div class="col" style="display:inline-block;width:${widths[i]}%;max-width:100%;vertical-align:top;font-size:15px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></div>`
    })
    .join('') // sin espacios entre divs: inline-block es sensible al whitespace

  const bg = section.config.background_color ? `background:${esc(section.config.background_color)};` : ''
  const padV = Math.min(Math.max(section.config.padding ?? 0, 0), 80)
  return `<tr><td style="${bg}padding:${padV}px 0;font-size:0;text-align:left">${cols}</td></tr>`
}

/**
 * Diseño V2 → HTML compatible con clientes de correo (tablas + estilos inline, 600px).
 * - `merge`: personalización de asunto/textos por destinatario.
 * - `unsubscribeUrl`: SIEMPRE se añade el pie legal con link de baja (null → texto sin link, para pruebas).
 * - `rewriteUrl`: reescritura de links para tracking (fase de envío); por defecto deja la URL tal cual.
 * - `viewInBrowserUrl`: link "Ver este email en el navegador" (solo campañas reales).
 */
export function renderEmailHtml(opts: {
  design: EmailDesign
  merge: MergeData
  unsubscribeUrl: string | null
  rewriteUrl?: (url: string) => string
  viewInBrowserUrl?: string | null
}): string {
  const { design, merge, unsubscribeUrl, viewInBrowserUrl } = opts
  const rewrite = opts.rewriteUrl ?? ((u: string) => u)
  const styles = design.styles

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const sectionRows = design.sections
    .map((s) =>
      renderSection(s, {
        merge,
        rewrite,
        buttonColor: styles.button_color,
        // en columnas el padding horizontal de bloque baja de 32 a 16px
        pad: s.columns.length > 1 ? 16 : 32,
        siteUrl,
      })
    )
    .join('\n')

  const unsubscribe = unsubscribeUrl
    ? `<a href="${esc(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline">Darse de baja</a>`
    : '<span style="color:#94a3b8">Darse de baja</span>'

  const viewInBrowser = viewInBrowserUrl
    ? `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
        <tr><td style="padding:0 8px 10px;text-align:center;font-family:${FONT};font-size:12px;color:#94a3b8">
          <a href="${esc(viewInBrowserUrl)}" style="color:#94a3b8;text-decoration:underline">Ver este email en el navegador</a>
        </td></tr>
      </table>`
    : ''

  const bg = esc(styles.background_color)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media (max-width:480px){.col{display:block!important;width:100%!important}}</style>
</head><body style="margin:0;padding:0;background:${bg}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}">
    <tr><td align="center" style="padding:32px 12px">
      ${viewInBrowser}
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px">
        ${sectionRows}
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
