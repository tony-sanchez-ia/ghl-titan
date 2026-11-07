'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { importContactsFromCsv } from '@/actions/contacts'

interface Props {
  open: boolean
  onClose: () => void
}

interface Result {
  format: 'ghl' | 'brevo'
  total: number
  newCount: number
  updateCount: number
  unsubscribedBlocklisted: number
  unsubscribedNotSubscribed: number
  discarded: number
}

export function ImportDialog({ open, onClose }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  if (!open) return null

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo CSV')
      return
    }
    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tags', tags)
    const res = await importContactsFromCsv(formData)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const brevo = res.format === 'brevo' ? res : null
    setResult({
      format: res.format ?? 'ghl',
      total: res.total ?? 0,
      newCount: res.newCount ?? 0,
      updateCount: res.updateCount ?? 0,
      unsubscribedBlocklisted: brevo?.unsubscribedBlocklisted ?? 0,
      unsubscribedNotSubscribed: brevo?.unsubscribedNotSubscribed ?? 0,
      discarded: brevo?.discarded ?? 0,
    })
    router.refresh()
  }

  function close() {
    setFileName(null)
    setTags('')
    setError(null)
    setResult(null)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${ui.card} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Importar contactos</h2>
          <button onClick={close} aria-label="Cerrar" className="text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <p className="font-medium">Importación completada</p>
            </div>
            <ul className="text-sm text-muted space-y-1">
              <li>Total procesados: <span className="text-fg font-medium">{result.total}</span></li>
              <li>Nuevos: <span className="text-fg font-medium">{result.newCount}</span></li>
              <li>Actualizados: <span className="text-fg font-medium">{result.updateCount}</span></li>
              {result.format === 'brevo' && (
                <>
                  <li>
                    Dados de baja (bloqueados en Brevo):{' '}
                    <span className="text-fg font-medium">{result.unsubscribedBlocklisted}</span>
                  </li>
                  <li>
                    Dados de baja (no suscritos a email en Brevo):{' '}
                    <span className="text-fg font-medium">{result.unsubscribedNotSubscribed}</span>
                  </li>
                  {result.discarded > 0 && (
                    <li>
                      Filas descartadas (sin email válido):{' '}
                      <span className="text-fg font-medium">{result.discarded}</span>
                    </li>
                  )}
                </>
              )}
            </ul>
            <button onClick={close} className={`${ui.buttonPrimary} w-full px-4 py-2.5`}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Admite exportaciones de GoHighLevel y de Brevo (se detecta solo). Los contactos se
              deduplican automáticamente: reimportar no crea duplicados ni borra datos.
            </p>

            <label className="block">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                <Upload size={24} className="mx-auto text-muted" />
                <p className="mt-2 text-sm text-muted">
                  {fileName ?? 'Haz clic para seleccionar el CSV'}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>

            <div>
              <label htmlFor="import_tags" className="block text-sm font-medium mb-1">
                Etiqueta para todos los importados
              </label>
              <input
                id="import_tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Ej.: Compradores 2025 concierto Barcelona Razzmatazz"
                className={ui.input}
              />
              <p className="text-xs text-muted mt-1">Opcional. Varias separadas por comas.</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button onClick={close} className={`${ui.button} flex-1 px-4 py-2.5`}>
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className={`${ui.buttonPrimary} flex-1 px-4 py-2.5 disabled:opacity-50`}
              >
                {loading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
