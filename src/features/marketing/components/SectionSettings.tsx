'use client'

import { ui } from '@/shared/lib/ui'
import { LAYOUT_COLUMNS } from '../services/design'
import type { EmailSection, EmailSectionConfig } from '@/types/database'

/** Panel de ajustes de la sección seleccionada: fondo y espaciado. */
export function SectionSettings({
  section,
  onChange,
}: {
  section: EmailSection
  onChange: (config: EmailSectionConfig) => void
}) {
  const c = section.config
  const set = (patch: EmailSectionConfig) => onChange({ ...c, ...patch })

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Sección</h3>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted">Diseño</span>
        <div className="flex gap-0.5 w-20 h-9">
          {LAYOUT_COLUMNS[section.layout].map((w, i) => (
            <div key={i} className="rounded-sm bg-primary-soft border border-primary/30" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="text-xs text-muted">
          {section.columns.length} {section.columns.length === 1 ? 'columna' : 'columnas'} — en el móvil se apilan.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">Color de fondo</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={c.background_color ?? '#ffffff'}
            onChange={(e) => set({ background_color: e.target.value })}
            className="h-9 w-12 rounded border border-border cursor-pointer bg-card"
          />
          <button
            type="button"
            onClick={() => set({ background_color: undefined })}
            className={`${ui.button} px-2.5 py-1.5 text-xs`}
            disabled={!c.background_color}
          >
            Sin fondo
          </button>
        </div>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">Espaciado vertical: {c.padding ?? 0}px</span>
        <input
          type="range"
          min={0}
          max={80}
          step={4}
          value={c.padding ?? 0}
          onChange={(e) => set({ padding: Number(e.target.value) })}
          className="w-full"
        />
      </label>
    </div>
  )
}
