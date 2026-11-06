export const MAX_LOGO_BYTES = 500 * 1024

type LogoMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml'

/**
 * Tipo real del logo por su contenido (magic bytes), nunca por la extensión.
 * SVG: texto cuyo elemento raíz es <svg> y sin <script> ni manejadores on*= (defensa extra:
 * además se sirve solo como <img> y con CSP sandbox).
 */
export function detectLogoMime(bytes: Buffer): LogoMime | null {
  const hex = bytes.subarray(0, 12).toString('hex')
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png'
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  if (hex.startsWith('52494646') && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'

  const text = bytes.toString('utf8')
  const head = text
    .replace(/^﻿/, '')
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .trimStart()
  if (/^<svg[\s>]/i.test(head) && !/<script|\son\w+\s*=|javascript:/i.test(text)) return 'image/svg+xml'
  return null
}
