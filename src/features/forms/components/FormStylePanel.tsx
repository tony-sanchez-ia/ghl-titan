'use client'

import { ui } from '@/shared/lib/ui'
import type { FormStyles, FormTheme, LabelAlign } from '@/types/database'
import { FORM_THEMES } from '../services/schema'

const THEME_LABELS: Record<FormTheme, string> = {
  clean: 'Limpio',
  card: 'Tarjeta',
  minimal: 'Minimal',
}

export function FormStylePanel({
  styles,
  onChange,
}: {
  styles: FormStyles
  onChange: (patch: Partial<FormStyles>) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Tema</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(FORM_THEMES) as FormTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange(FORM_THEMES[t])}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                styles.theme === t ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-bg'
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-semibold text-sm">Colores</h3>
        <Color label="Fondo del formulario" value={styles.background_color} onChange={(v) => onChange({ background_color: v })} />
        <Color label="Texto" value={styles.text_color} onChange={(v) => onChange({ text_color: v })} />
        <Color label="Botón" value={styles.button_color} onChange={(v) => onChange({ button_color: v })} />
        <Color label="Texto del botón" value={styles.button_text_color} onChange={(v) => onChange({ button_text_color: v })} />
        <Color label="Borde" value={styles.border_color} onChange={(v) => onChange({ border_color: v })} />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-semibold text-sm">Bordes y tamaño</h3>
        <Range label="Grosor del borde" value={styles.border_width} min={0} max={8} onChange={(v) => onChange({ border_width: v })} unit="px" />
        <Range label="Redondeo del contenedor" value={styles.border_radius} min={0} max={40} onChange={(v) => onChange({ border_radius: v })} unit="px" />
        <Range label="Redondeo de campos" value={styles.field_radius} min={0} max={30} onChange={(v) => onChange({ field_radius: v })} unit="px" />
        <Range label="Ancho máximo" value={styles.width} min={320} max={900} step={10} onChange={(v) => onChange({ width: v })} unit="px" />
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="font-semibold text-sm">Etiquetas</h3>
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-sm">
          {(['top', 'left'] as LabelAlign[]).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ label_align: a })}
              className={`flex-1 px-3 py-2 ${styles.label_align === a ? 'bg-primary-soft text-primary' : 'text-muted'}`}
            >
              {a === 'top' ? 'Arriba' : 'Izquierda'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-muted">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-border cursor-pointer bg-card"
        />
      </span>
    </label>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        <span className="font-mono">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}
