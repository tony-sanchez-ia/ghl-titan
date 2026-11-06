'use client'

import { useState } from 'react'
import { ui } from '@/shared/lib/ui'
import { updateBrand, uploadLogo, removeLogo } from '@/actions/instance'
import type { InstanceSettings } from '@/features/instance/types'

const DEFAULT_ACCENT = '#2563eb'

type Status = { ok?: string; error?: string }

export function BrandForm({ brand }: { brand: Pick<InstanceSettings, 'brandName' | 'accentColor' | 'logoVersion'> }) {
  const [name, setName] = useState(brand.brandName ?? '')
  const [color, setColor] = useState(brand.accentColor ?? '')
  const [brandStatus, setBrandStatus] = useState<Status>({})
  const [logoStatus, setLogoStatus] = useState<Status>({})
  const [loading, setLoading] = useState(false)

  async function handleSaveBrand() {
    setLoading(true)
    const res = await updateBrand({ brandName: name, accentColor: color })
    setLoading(false)
    setBrandStatus('error' in res ? { error: res.error } : { ok: 'Marca guardada' })
  }

  async function handleUpload(formData: FormData) {
    setLoading(true)
    const res = await uploadLogo(formData)
    setLoading(false)
    setLogoStatus('error' in res ? { error: res.error } : { ok: 'Logo actualizado' })
  }

  async function handleRemove() {
    setLoading(true)
    const res = await removeLogo()
    setLoading(false)
    setLogoStatus('error' in res ? { error: res.error } : { ok: 'Logo quitado' })
  }

  return (
    <div className={`${ui.card} p-5 space-y-6 max-w-lg`}>
      <div>
        <h2 className="font-semibold">Marca</h2>
        <p className="text-sm text-muted mt-1">
          Logo, nombre y color del panel y de la pantalla de entrar. Embudos, webs y emails no cambian.
        </p>
      </div>

      {/* Logo */}
      <form action={handleUpload} className="space-y-3">
        <label className="block text-sm font-medium">Logo</label>
        {brand.logoVersion ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo servido desde BD */}
            <img src={`/api/brand/logo?v=${brand.logoVersion}`} alt="Logo actual" className="max-h-12 max-w-[200px] object-contain rounded border border-border p-1" />
            <button type="button" onClick={handleRemove} disabled={loading} className={`${ui.button} px-3 py-1.5 text-sm disabled:opacity-50`}>
              Quitar logo
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">Sin logo: arriba a la izquierda se muestra el nombre.</p>
        )}
        <div className="flex items-center gap-3">
          <input
            type="file"
            name="logo"
            required
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-fg"
          />
          <button type="submit" disabled={loading} className={`${ui.button} px-3 py-1.5 text-sm shrink-0 disabled:opacity-50`}>
            Subir
          </button>
        </div>
        <p className="text-xs text-muted">PNG, JPG, WEBP o SVG. Máximo 500 KB. Mejor horizontal y con fondo transparente.</p>
        {logoStatus.error && <p className="text-sm text-red-600">{logoStatus.error}</p>}
        {logoStatus.ok && <p className="text-sm text-emerald-600">{logoStatus.ok}</p>}
      </form>

      {/* Nombre + color */}
      <div className="space-y-4 border-t border-border pt-5">
        <div>
          <label htmlFor="brand_name" className="block text-sm font-medium mb-1">Nombre de la empresa</label>
          <input
            id="brand_name"
            value={name}
            maxLength={60}
            placeholder="GHL Titan"
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
          />
          <p className="text-xs text-muted mt-1">Sale en la pestaña del navegador y, si no hay logo, en el menú.</p>
        </div>
        <div>
          <label htmlFor="accent_color" className="block text-sm font-medium mb-1">Color de acento</label>
          <div className="flex items-center gap-3">
            <input
              id="accent_color"
              type="color"
              value={color || DEFAULT_ACCENT}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border bg-card"
            />
            <span className="text-sm font-mono text-muted">{color || 'Por defecto (azul)'}</span>
            {color && (
              <button type="button" onClick={() => setColor('')} className="text-sm text-primary hover:underline">
                Restablecer
              </button>
            )}
          </div>
        </div>
        {brandStatus.error && <p className="text-sm text-red-600">{brandStatus.error}</p>}
        {brandStatus.ok && <p className="text-sm text-emerald-600">{brandStatus.ok}</p>}
        <button type="button" onClick={handleSaveBrand} disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
          {loading ? 'Guardando...' : 'Guardar marca'}
        </button>
      </div>
    </div>
  )
}
