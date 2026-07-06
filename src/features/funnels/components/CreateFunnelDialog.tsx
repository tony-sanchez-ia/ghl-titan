'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { createFunnel } from '@/actions/funnels'

export function CreateFunnelDialog({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withAi = aiEnabled && brief.trim().length > 0

  async function onCreate() {
    setBusy(true)
    setError(null)
    const res = await createFunnel({ name, brief: brief.trim() || undefined })
    if (res.error || !res.id) {
      setBusy(false)
      setError(res.error ?? 'No se pudo crear el embudo')
      return
    }
    if (res.aiError) alert(res.aiError)
    router.push(`/funnels/${res.id}`)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
        <Plus size={16} /> Nuevo embudo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${ui.card} w-full max-w-lg p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nuevo embudo</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-fg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej., Embudo curso de trading"
                className={ui.input}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Brief del negocio <span className="text-muted font-normal">(opcional)</span>
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                placeholder="Qué vendes, a quién, precio, tono... La IA lo usará para diseñar la página por ti."
                className={ui.input}
              />
              {!aiEnabled && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  La IA no está configurada todavía (falta la clave de OpenRouter): el embudo se
                  creará con una página en blanco.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className={`${ui.button} px-3 py-2 text-sm`}>
                Cancelar
              </button>
              <button
                onClick={onCreate}
                disabled={busy || !name.trim()}
                className={`${ui.buttonPrimary} px-3 py-2 text-sm disabled:opacity-50`}
              >
                {busy ? (withAi ? 'La IA está diseñando tu embudo…' : 'Creando…') : 'Crear embudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
