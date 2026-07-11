'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { RichTextInput } from '@/shared/components/rich-text-input'
import type { FieldOption, FormField } from '@/types/database'
import { isContentField, isReservedKey, needsOptions } from '../services/schema'

export function FieldSettings({
  field,
  onChange,
  onDelete,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
  onDelete: () => void
}) {
  const content = isContentField(field.type)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Ajustes del campo</h3>
        <button onClick={onDelete} className="text-red-600 hover:opacity-80" title="Borrar campo">
          <Trash2 size={15} />
        </button>
      </div>

      {field.type === 'heading' && (
        <Labeled label="Texto del título">
          <input
            className={`${ui.input} text-sm`}
            value={field.content_html ?? ''}
            onChange={(e) => onChange({ content_html: e.target.value })}
          />
        </Labeled>
      )}

      {field.type === 'paragraph' && (
        <Labeled label="Texto del párrafo">
          <RichTextInput
            key={field.id}
            value={field.content_html ?? ''}
            onChange={(html) => onChange({ content_html: html })}
          />
        </Labeled>
      )}

      {!content && (
        <>
          <Labeled label="Etiqueta">
            <input
              className={`${ui.input} text-sm`}
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </Labeled>

          <Labeled
            label="Clave del dato"
            hint={isReservedKey(field.key) ? 'Se guarda en la ficha del contacto' : 'Se guarda en el envío'}
          >
            <input
              className={`${ui.input} text-sm font-mono`}
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value })}
            />
          </Labeled>

          {field.type !== 'consent' && field.type !== 'hidden' && !needsOptions(field.type) && (
            <Labeled label="Texto de ejemplo (placeholder)">
              <input
                className={`${ui.input} text-sm`}
                value={field.placeholder ?? ''}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </Labeled>
          )}

          {field.type === 'hidden' && (
            <Labeled label="Valor por defecto">
              <input
                className={`${ui.input} text-sm`}
                value={field.default_value ?? ''}
                onChange={(e) => onChange({ default_value: e.target.value })}
              />
            </Labeled>
          )}

          {needsOptions(field.type) && (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(options) => onChange({ options })}
            />
          )}

          <Labeled label="Texto de ayuda (opcional)">
            <input
              className={`${ui.input} text-sm`}
              value={field.help ?? ''}
              onChange={(e) => onChange({ help: e.target.value })}
            />
          </Labeled>

          {field.type !== 'hidden' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Obligatorio
            </label>
          )}
        </>
      )}
    </div>
  )
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </label>
  )
}

function slugValue(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: FieldOption[]
  onChange: (options: FieldOption[]) => void
}) {
  function update(i: number, patch: Partial<FieldOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted">Opciones</span>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={`${ui.input} text-sm`}
            value={o.label}
            placeholder="Etiqueta"
            onChange={(e) =>
              update(i, {
                label: e.target.value,
                value: slugValue(e.target.value) || o.value,
              })
            }
          />
          <button
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="text-muted hover:text-red-600 shrink-0"
            title="Quitar opción"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...options, { label: `Opción ${options.length + 1}`, value: `opcion-${options.length + 1}` }])
        }
        className={`${ui.button} px-2.5 py-1.5 text-xs`}
      >
        <Plus size={13} /> Añadir opción
      </button>
    </div>
  )
}
