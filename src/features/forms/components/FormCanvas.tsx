'use client'

import { ArrowDown, ArrowUp, Columns2, Rows3, Trash2 } from 'lucide-react'
import type { FormField, FormSchema, FormSettings, FormStyles } from '@/types/database'
import { isContentField } from '../services/schema'
import { containerStyle, fieldRows, FieldRow, SubmitButtonView } from './form-render'

/** Lienzo del editor: formulario real (estático) con controles de edición por campo. */
export function FormCanvas({
  schema,
  styles,
  settings,
  selectedId,
  mobile,
  onSelect,
  onMove,
  onToggleWidth,
  onDelete,
}: {
  schema: FormSchema
  styles: FormStyles
  settings: FormSettings
  selectedId: string | null
  mobile: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, dir: -1 | 1) => void
  onToggleWidth: (id: string) => void
  onDelete: (id: string) => void
}) {
  const rows = mobile ? schema.fields.map((f) => [f]) : fieldRows(schema.fields)

  return (
    <div
      className="mx-auto w-full border p-6 space-y-4"
      style={containerStyle(styles)}
      onClick={() => onSelect(null)}
    >
      {schema.fields.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-current/20 py-12 text-center text-sm opacity-60">
          Añade campos desde el panel de la izquierda.
        </div>
      )}

      {rows.map((row, ri) => (
        <div key={ri} className={row.length === 2 ? 'grid grid-cols-2 gap-4' : ''}>
          {row.map((field) => (
            <SelectableField
              key={field.id}
              field={field}
              styles={styles}
              selected={selectedId === field.id}
              onSelect={onSelect}
              onMove={onMove}
              onToggleWidth={onToggleWidth}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}

      <div className="pt-2">
        <SubmitButtonView styles={styles} label={settings.submit_label || 'Enviar'} />
      </div>
    </div>
  )
}

function SelectableField({
  field,
  styles,
  selected,
  onSelect,
  onMove,
  onToggleWidth,
  onDelete,
}: {
  field: FormField
  styles: FormStyles
  selected: boolean
  onSelect: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onToggleWidth: (id: string) => void
  onDelete: (id: string) => void
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <div
      onClick={(e) => {
        stop(e)
        onSelect(field.id)
      }}
      className={`relative rounded-lg p-2 -m-2 cursor-pointer transition-shadow ${
        selected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/40'
      }`}
    >
      {/* El campo real, no interactivo (los clics seleccionan) */}
      <div className="pointer-events-none">
        <FieldRow field={field} styles={styles} interactive={false} />
      </div>

      {selected && (
        <div
          onClick={stop}
          className="absolute -top-3 right-1 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm"
        >
          <IconBtn title="Subir" onClick={() => onMove(field.id, -1)}>
            <ArrowUp size={13} />
          </IconBtn>
          <IconBtn title="Bajar" onClick={() => onMove(field.id, 1)}>
            <ArrowDown size={13} />
          </IconBtn>
          {!isContentField(field.type) && (
            <IconBtn
              title={field.width === 'half' ? 'Ancho completo' : 'Media columna'}
              onClick={() => onToggleWidth(field.id)}
            >
              {field.width === 'half' ? <Rows3 size={13} /> : <Columns2 size={13} />}
            </IconBtn>
          )}
          <IconBtn title="Borrar" onClick={() => onDelete(field.id)} danger>
            <Trash2 size={13} />
          </IconBtn>
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1 rounded hover:bg-bg transition-colors ${danger ? 'text-red-600' : 'text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  )
}
