/** Color de acento validado: hex de 6 dígitos en minúsculas (igual que el CHECK de la BD). */
export const HEX_COLOR = /^#[0-9a-f]{6}$/

/** Texto legible sobre el acento: negro si el color es claro, blanco si es oscuro (luminancia WCAG). */
export function readableTextOn(hex: string): '#000000' | '#ffffff' {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return lum > 0.4 ? '#000000' : '#ffffff'
}

/** CSS que sobreescribe los tokens de acento de globals.css (claro y modo noche). */
export function brandCss(hex: string): string {
  if (!HEX_COLOR.test(hex)) return ''
  const fg = readableTextOn(hex)
  return (
    `:root{--primary:${hex};--primary-fg:${fg};--primary-soft:color-mix(in srgb,${hex} 12%,#ffffff)}` +
    `.dark{--primary:${hex};--primary-fg:${fg};--primary-soft:color-mix(in srgb,${hex} 25%,#1e293b)}`
  )
}
