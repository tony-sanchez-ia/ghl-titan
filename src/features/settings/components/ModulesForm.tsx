'use client'

import { useState } from 'react'
import { ui } from '@/shared/lib/ui'
import { updateModules } from '@/actions/instance'
import { Switch } from '@/shared/components/switch'
import type { ModuleKey } from '@/features/instance/types'

const MODULES: { key: ModuleKey; label: string; hint: string }[] = [
  { key: 'calendars', label: 'Agenda', hint: 'Reservas de llamadas y citas' },
  { key: 'courses', label: 'Cursos', hint: 'Cursos online y alumnos' },
  { key: 'funnels', label: 'Embudos', hint: 'Páginas de venta y lanzamiento' },
  { key: 'websites', label: 'Sitios web', hint: 'Webs de varias páginas' },
  { key: 'forms', label: 'Formularios', hint: 'Editor de formularios de captación' },
]

export function ModulesForm({ modules }: { modules: Record<ModuleKey, boolean> }) {
  const [values, setValues] = useState(modules)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    setMsg(null)
    setError(null)
    const res = await updateModules(values)
    setLoading(false)
    if ('error' in res) setError(res.error)
    else setMsg('Módulos guardados')
  }

  return (
    <div className={`${ui.card} p-5 space-y-4 max-w-lg`}>
      <div>
        <h2 className="font-semibold">Módulos</h2>
        <p className="text-sm text-muted mt-1">
          Oculta del menú las secciones que esta instancia no usa. Lo ya publicado (páginas,
          formularios, reservas, accesos a cursos) sigue funcionando.
        </p>
      </div>
      <div className="divide-y divide-border">
        {MODULES.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-4 py-3">
            <span>
              <span id={`module-${m.key}`} className="block text-sm font-medium">{m.label}</span>
              <span className="block text-xs text-muted">{m.hint}</span>
            </span>
            <Switch
              checked={values[m.key]}
              labelledBy={`module-${m.key}`}
              onChange={(checked) => setValues((v) => ({ ...v, [m.key]: checked }))}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <button type="button" onClick={handleSave} disabled={loading} className={`${ui.buttonPrimary} px-4 py-2.5 disabled:opacity-50`}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
