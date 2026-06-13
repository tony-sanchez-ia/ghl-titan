/**
 * Render de markdown mínimo a HTML seguro (sin dependencias).
 * Soporta: escape HTML, **negrita**, *cursiva*, enlaces, listas, párrafos.
 * El contenido lo escribe el admin, pero se escapa igualmente para evitar XSS.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-primary underline">$1</a>'
    )
}

export function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md ?? '')
  const lines = escaped.split('\n')
  const html: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      const size = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'
      html.push(`<h${level} class="${size} font-bold mt-2">${inline(heading[2])}</h${level}>`)
      continue
    }
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      if (!inList) {
        html.push('<ul class="list-disc pl-5 space-y-1">')
        inList = true
      }
      html.push(`<li>${inline(listMatch[1])}</li>`)
    } else {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<p>${inline(line)}</p>`)
    }
  }
  if (inList) html.push('</ul>')
  return html.join('\n')
}
