/**
 * Normaliza una URL de vídeo a su URL de embed para <iframe>.
 * Soporta YouTube, Vimeo y Bunny. Si no reconoce, devuelve la URL tal cual.
 */
export function toEmbedUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''

  // YouTube: watch?v=ID | youtu.be/ID | shorts/ID
  const yt =
    u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`

  // Vimeo: vimeo.com/ID
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`

  // Bunny / iframe.mediadelivery.net o ya es un /embed → tal cual
  return u
}
