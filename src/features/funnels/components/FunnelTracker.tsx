'use client'

import { useEffect } from 'react'

/**
 * Tracking de clicks de CTA en la página pública: listener delegado sobre
 * [data-cta] + sendBeacon (sobrevive a la navegación del enlace).
 */
export function FunnelTracker({ stepId, variantId }: { stepId: string; variantId: string }) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cta]')
      if (!target) return
      const payload = JSON.stringify({
        step_id: stepId,
        variant_id: variantId,
        type: 'cta_click',
        metadata: { block_id: target.dataset.cta ?? '' },
      })
      try {
        if (!navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) {
          void fetch('/api/track', { method: 'POST', body: payload, keepalive: true })
        }
      } catch {
        /* el tracking jamás rompe la página */
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [stepId, variantId])

  return null
}
