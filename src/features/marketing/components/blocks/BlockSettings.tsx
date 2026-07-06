'use client'

import { ui } from '@/shared/lib/ui'
import type { EmailBlock, EmailBlockConfig } from '@/types/database'

const BLOCK_LABELS: Record<EmailBlock['type'], string> = {
  header: 'Cabecera',
  text: 'Texto',
  image: 'Imagen',
  button: 'Botón',
  divider: 'Divisor',
  spacer: 'Espaciador',
  footer: 'Pie de página',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function AlignPicker({
  value,
  onChange,
}: {
  value: EmailBlockConfig['align']
  onChange: (v: 'left' | 'center' | 'right') => void
}) {
  return (
    <div className="flex gap-1">
      {(['left', 'center', 'right'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
            (value ?? 'left') === a ? 'border-primary text-primary bg-primary-soft' : 'border-border text-muted'
          }`}
        >
          {a === 'left' ? 'Izquierda' : a === 'center' ? 'Centro' : 'Derecha'}
        </button>
      ))}
    </div>
  )
}

/** Panel de ajustes del bloque seleccionado. Actualiza el config en vivo. */
export function BlockSettings({
  block,
  onChange,
}: {
  block: EmailBlock
  onChange: (config: EmailBlockConfig) => void
}) {
  const c = block.config
  const set = (patch: EmailBlockConfig) => onChange({ ...c, ...patch })
  const input = `${ui.input} text-sm`

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{BLOCK_LABELS[block.type]}</h3>

      {block.type === 'header' && (
        <>
          <Field label="URL del logotipo (opcional)">
            <input className={input} value={c.logo_url ?? ''} onChange={(e) => set({ logo_url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Nombre / título">
            <input className={input} value={c.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Tu negocio" />
          </Field>
        </>
      )}

      {block.type === 'text' && (
        <>
          <Field label="Texto">
            <textarea
              className={`${input} min-h-40 resize-y`}
              value={c.text ?? ''}
              onChange={(e) => set({ text: e.target.value })}
              placeholder={'Hola {{nombre}},\n\nTu mensaje…'}
            />
          </Field>
          <Field label="Tamaño">
            <select className={input} value={c.size ?? 'normal'} onChange={(e) => set({ size: e.target.value as 'normal' | 'title' | 'subtitle' })}>
              <option value="normal">Normal</option>
              <option value="subtitle">Subtítulo</option>
              <option value="title">Título</option>
            </select>
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
          <p className="text-xs text-muted">
            Personalización: <code className="bg-bg px-1 rounded">{'{{nombre}}'}</code>{' '}
            <code className="bg-bg px-1 rounded">{'{{apellido}}'}</code>{' '}
            <code className="bg-bg px-1 rounded">{'{{email}}'}</code> se sustituyen por los datos de cada contacto.
          </p>
        </>
      )}

      {block.type === 'image' && (
        <>
          <Field label="URL de la imagen">
            <input className={input} value={c.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Texto alternativo">
            <input className={input} value={c.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Descripción de la imagen" />
          </Field>
          <Field label="Enlace al hacer click (opcional)">
            <input className={input} value={c.link_url ?? ''} onChange={(e) => set({ link_url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
        </>
      )}

      {block.type === 'button' && (
        <>
          <Field label="Texto del botón">
            <input className={input} value={c.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Reserva tu sesión" />
          </Field>
          <Field label="Enlace">
            <input className={input} value={c.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
        </>
      )}

      {block.type === 'spacer' && (
        <Field label={`Altura: ${c.height ?? 24}px`}>
          <input
            type="range"
            min={4}
            max={160}
            step={4}
            value={c.height ?? 24}
            onChange={(e) => set({ height: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      )}

      {block.type === 'divider' && <p className="text-sm text-muted">Una línea separadora. No tiene ajustes.</p>}

      {block.type === 'footer' && (
        <>
          <Field label="Texto del pie (datos del negocio)">
            <textarea
              className={`${input} min-h-24 resize-y`}
              value={c.footer_text ?? ''}
              onChange={(e) => set({ footer_text: e.target.value })}
              placeholder={'Tu negocio\nDirección · Teléfono'}
            />
          </Field>
          <p className="text-xs text-muted">
            El enlace «Darse de baja» se añade siempre automáticamente al final del email (obligatorio por ley).
          </p>
        </>
      )}
    </div>
  )
}
