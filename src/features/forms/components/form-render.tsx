import type { CSSProperties } from 'react'
import type { FormField, FormStyles } from '@/types/database'
import { isContentField } from '../services/schema'

/**
 * Render PURO de un formulario (sin hooks ni handlers): lo usan el lienzo del
 * editor (interactive=false, estático) y la página pública (interactive=true,
 * inputs reales con `name` para recoger el envío por FormData). Los estilos
 * llegan SIEMPRE de `styles` (inline) para que funcione incrustado en cualquier web.
 */

export function containerStyle(styles: FormStyles): CSSProperties {
  return {
    background: styles.background_color,
    color: styles.text_color,
    borderColor: styles.border_color,
    borderWidth: styles.border_width,
    borderStyle: 'solid',
    borderRadius: styles.border_radius,
    maxWidth: styles.width,
  }
}

function fieldStyle(styles: FormStyles): CSSProperties {
  return {
    borderColor: styles.border_color,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: styles.field_radius,
    background: '#ffffff',
    color: '#0f172a',
  }
}

const INPUT_CLASS = 'w-full px-3 py-2.5 text-[15px] outline-none'

/** El control de entrada según el tipo de campo (sin label). */
function FieldControl({
  field,
  styles,
  interactive,
}: {
  field: FormField
  styles: FormStyles
  interactive: boolean
}) {
  const fs = fieldStyle(styles)
  const common = { name: field.key, disabled: !interactive, style: fs, className: INPUT_CLASS }

  switch (field.type) {
    case 'textarea':
      return <textarea name={field.key} disabled={!interactive} style={fs} className={`${INPUT_CLASS} resize-y`} rows={4} placeholder={field.placeholder} required={interactive && field.required} />
    case 'select':
      return (
        <select name={field.key} disabled={!interactive} style={fs} className={INPUT_CLASS} required={interactive && field.required} defaultValue="">
          <option value="" disabled>
            {field.placeholder || 'Elige una opción…'}
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'radio':
      return (
        <div className="space-y-1.5 pt-1">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-[15px]">
              <input type="radio" name={field.key} value={o.value} disabled={!interactive} required={interactive && field.required} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    case 'checkbox_group':
      return (
        <div className="space-y-1.5 pt-1">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name={field.key} value={o.value} disabled={!interactive} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    case 'consent':
      return (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name={field.key} value="on" disabled={!interactive} required={interactive && field.required} className="mt-0.5" />
          <span>{field.label}</span>
        </label>
      )
    case 'date':
      return <input {...common} type="date" required={interactive && field.required} />
    case 'number':
      return <input {...common} type="number" placeholder={field.placeholder} required={interactive && field.required} />
    case 'email':
      return <input {...common} type="email" placeholder={field.placeholder} required={interactive && field.required} />
    case 'phone':
      return <input {...common} type="tel" placeholder={field.placeholder} required={interactive && field.required} />
    default: // text
      return <input {...common} type="text" placeholder={field.placeholder} required={interactive && field.required} />
  }
}

/** Un campo completo (label + control + ayuda), o contenido estático. */
export function FieldRow({
  field,
  styles,
  interactive,
}: {
  field: FormField
  styles: FormStyles
  interactive: boolean
}) {
  if (field.type === 'hidden') {
    if (interactive) return <input type="hidden" name={field.key} defaultValue={field.default_value ?? ''} />
    return (
      <div className="rounded-md border border-dashed border-current/25 px-3 py-1.5 text-xs opacity-60">
        Campo oculto · {field.key}
      </div>
    )
  }

  if (field.type === 'heading') {
    return <h3 className="text-lg font-bold pt-1">{field.content_html || field.label}</h3>
  }
  if (field.type === 'paragraph') {
    return (
      <div
        className="text-sm opacity-80 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: field.content_html || '' }}
      />
    )
  }

  // consent lleva su propio label incrustado
  if (field.type === 'consent') {
    return <FieldControl field={field} styles={styles} interactive={interactive} />
  }

  const labelEl = (
    <label className="block text-sm font-medium mb-1">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  )

  if (styles.label_align === 'left') {
    return (
      <div className="flex items-start gap-3">
        <div className="w-32 shrink-0 pt-2">{labelEl}</div>
        <div className="flex-1 min-w-0">
          <FieldControl field={field} styles={styles} interactive={interactive} />
          {field.help && <p className="text-xs opacity-60 mt-1">{field.help}</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {labelEl}
      <FieldControl field={field} styles={styles} interactive={interactive} />
      {field.help && <p className="text-xs opacity-60 mt-1">{field.help}</p>}
    </div>
  )
}

/** Botón de envío con los colores del formulario. */
export function SubmitButtonView({
  styles,
  label,
  loading,
}: {
  styles: FormStyles
  label: string
  loading?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full px-6 py-3 text-base font-semibold shadow-sm disabled:opacity-60"
      style={{ background: styles.button_color, color: styles.button_text_color, borderRadius: styles.field_radius }}
    >
      {loading ? 'Enviando…' : label}
    </button>
  )
}

/** Distribuye los campos en filas respetando el ancho ('full' | 'half'). */
export function fieldRows(fields: FormField[]): FormField[][] {
  const rows: FormField[][] = []
  let i = 0
  while (i < fields.length) {
    const f = fields[i]
    // Un 'half' seguido de otro 'half' (y ambos con control) comparten fila.
    const next = fields[i + 1]
    if (
      f.width === 'half' &&
      next &&
      next.width === 'half' &&
      !isContentField(f.type) &&
      !isContentField(next.type)
    ) {
      rows.push([f, next])
      i += 2
    } else {
      rows.push([f])
      i += 1
    }
  }
  return rows
}
