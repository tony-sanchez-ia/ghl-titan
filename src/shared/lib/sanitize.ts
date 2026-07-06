/**
 * Saneado de HTML sin dependencias (isomórfico: cliente para preview, servidor al guardar).
 * El HTML del usuario JAMÁS se confía: whitelist estricta para el texto con formato,
 * y limpieza de vectores peligrosos para el bloque de código HTML.
 */

const INLINE_ALLOWED = new Set(['b', 'strong', 'i', 'em', 'a', 'br'])

function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Decodifica las entidades básicas que produce contentEditable antes de re-escapar. */
function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function safeHref(raw: string): string | null {
  const url = raw.trim()
  return /^https?:\/\//i.test(url) ? url : null
}

/**
 * Texto con formato inline → HTML seguro con whitelist b/strong/i/em/a[href http(s)]/br.
 * - Cualquier otra etiqueta se elimina (su texto se conserva).
 * - Los atributos se descartan (solo href validado en <a>).
 * - Etiquetas desbalanceadas se cierran/descartan (stack).
 */
export function sanitizeInlineHtml(input: string): string {
  const out: string[] = []
  const stack: string[] = []
  let i = 0
  while (i < input.length) {
    const lt = input.indexOf('<', i)
    if (lt === -1) {
      out.push(escText(decodeBasicEntities(input.slice(i))))
      break
    }
    if (lt > i) out.push(escText(decodeBasicEntities(input.slice(i, lt))))
    const gt = input.indexOf('>', lt)
    if (gt === -1) {
      out.push(escText(decodeBasicEntities(input.slice(lt))))
      break
    }
    const tag = input.slice(lt + 1, gt)
    const m = tag.match(/^(\/?)([a-zA-Z0-9]+)/)
    const closing = m?.[1] === '/'
    let name = (m?.[2] ?? '').toLowerCase()
    // normalizar sinónimos de contentEditable
    if (name === 'div' || name === 'p') name = '__block__'
    if (INLINE_ALLOWED.has(name)) {
      if (name === 'br') {
        out.push('<br>')
      } else if (closing) {
        // cerrar solo si está abierta (descarta cierres sueltos)
        const idx = stack.lastIndexOf(name)
        if (idx !== -1) {
          for (let k = stack.length - 1; k >= idx; k--) out.push(`</${stack[k]}>`)
          const reopen = stack.splice(idx).slice(1)
          reopen.forEach((t) => {
            // <a> no se reabre sin href; el resto sí
            if (t !== 'a') {
              out.push(`<${t}>`)
              stack.push(t)
            }
          })
        }
      } else if (name === 'a') {
        const href = safeHref(tag.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/href\s*=\s*'([^']*)'/i)?.[1] ?? '')
        if (href) {
          out.push(`<a href="${escText(href)}" target="_blank" style="color:#2563eb;text-decoration:underline">`)
          stack.push('a')
        }
      } else {
        out.push(`<${name}>`)
        stack.push(name)
      }
    } else if (name === '__block__' && closing) {
      out.push('<br>') // los div/p de contentEditable se aplanan a saltos de línea
    }
    // cualquier otra etiqueta: se descarta (su contenido de texto ya se conserva)
    i = gt + 1
  }
  // cerrar lo que quedó abierto
  for (let k = stack.length - 1; k >= 0; k--) out.push(`</${stack[k]}>`)
  return out
    .join('')
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    .replace(/^(<br>)+|(<br>)+$/g, '')
    .slice(0, 20000)
}

/**
 * Bloque "Código HTML": se inserta casi tal cual, pero se eliminan los vectores
 * peligrosos (scripts, manejadores on*, javascript:, iframes/objetos/forms).
 */
export function sanitizeRawHtml(input: string): string {
  return input
    // bloques peligrosos CON su contenido (script/style)
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // etiquetas peligrosas sueltas (apertura, cierre o autocerradas)
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '$1="#"')
    .slice(0, 20000)
}

/** URLs de los <a href="…"> de un HTML ya saneado (para link_urls y tracking). */
export function extractHtmlUrls(html: string): string[] {
  const urls: string[] = []
  const re = /href="([^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const url = m[1].replace(/&amp;/g, '&')
    if (/^https?:\/\//i.test(url)) urls.push(url)
  }
  return urls
}

/** Reescribe los href de un HTML saneado (tracking de clicks de enlaces de texto). */
export function rewriteHtmlUrls(html: string, rewrite: (url: string) => string): string {
  return html.replace(/href="([^"]+)"/gi, (_full, raw: string) => {
    const url = raw.replace(/&amp;/g, '&')
    if (!/^https?:\/\//i.test(url)) return `href="${raw}"`
    return `href="${rewrite(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
  })
}
