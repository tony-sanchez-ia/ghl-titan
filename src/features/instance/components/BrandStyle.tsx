import { brandCss } from '../lib/brand-theme'

/** Inyecta el color de marca. Solo en layouts del panel y del login: lo público no cambia. */
export function BrandStyle({ accentColor }: { accentColor: string | null }) {
  if (!accentColor) return null
  return <style dangerouslySetInnerHTML={{ __html: brandCss(accentColor) }} />
}
