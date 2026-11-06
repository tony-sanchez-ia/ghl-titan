import type { InstanceSettings } from '../types'

/**
 * Cabecera de marca (sidebar y login): logo → nombre → "GHL Titan / Titanic Factory".
 * Sin imports de servidor: sirve tanto en server como en client components.
 */
export function BrandHeader({
  brand,
  size = 'sm',
}: {
  brand: Pick<InstanceSettings, 'brandName' | 'logoVersion'>
  size?: 'sm' | 'lg'
}) {
  const text = size === 'lg' ? 'text-2xl' : 'text-lg'

  if (brand.logoVersion) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo servido desde BD, tamaño variable
      <img
        src={`/api/brand/logo?v=${brand.logoVersion}`}
        alt={brand.brandName ?? 'Logo'}
        className={`${size === 'lg' ? 'max-h-14 mx-auto' : 'max-h-10'} max-w-full object-contain`}
      />
    )
  }

  if (brand.brandName) {
    return <h2 className={`${text} font-bold tracking-tight break-words`}>{brand.brandName}</h2>
  }

  return (
    <div>
      <h2 className={`${text} font-bold tracking-tight`}>
        GHL <span className="text-primary">Titan</span>
      </h2>
      {size === 'sm' && <p className="text-muted text-xs mt-0.5">Titanic Factory</p>}
    </div>
  )
}
