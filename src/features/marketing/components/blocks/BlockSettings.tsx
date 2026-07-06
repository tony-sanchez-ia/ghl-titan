'use client'

import { ui } from '@/shared/lib/ui'
import { SOCIAL_NETWORKS } from '../../services/design'
import type { EmailBlock, EmailBlockConfig, Form } from '@/types/database'
import { RichTextInput } from './RichTextInput'

const BLOCK_LABELS: Record<EmailBlock['type'], string> = {
  header: 'Cabecera',
  text: 'Texto',
  image: 'Imagen',
  button: 'Botón',
  divider: 'Divisor',
  spacer: 'Espaciador',
  footer: 'Pie de página',
  social: 'Redes sociales',
  video: 'Vídeo',
  form: 'Formulario',
  html: 'Código HTML (avanzado)',
}

function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Texto plano legado → HTML equivalente para el editor con formato. */
function plainToHtml(text: string): string {
  return escText(text).replace(/\n/g, '<br>')
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
  forms,
}: {
  block: EmailBlock
  onChange: (config: EmailBlockConfig) => void
  forms: Form[]
}) {
  const c = block.config
  const set = (patch: EmailBlockConfig) => onChange({ ...c, ...patch })
  const input = `${ui.input} text-sm`
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

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
          <Field label="Texto (negrita, cursiva y enlaces)">
            <RichTextInput
              key={block.id}
              value={c.html ?? plainToHtml(c.text ?? '')}
              onChange={(html) => set({ html, text: undefined })}
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

      {block.type === 'social' && (
        <>
          {SOCIAL_NETWORKS.map(({ network, label }) => {
            const current = c.networks?.find((n) => n.network === network)?.url ?? ''
            return (
              <Field key={network} label={label}>
                <input
                  className={input}
                  value={current}
                  placeholder="https://…"
                  onChange={(e) => {
                    const rest = (c.networks ?? []).filter((n) => n.network !== network)
                    const networks = e.target.value
                      ? [...rest, { network, url: e.target.value }]
                      : rest
                    // orden estable según la lista de redes
                    networks.sort(
                      (a, b) =>
                        SOCIAL_NETWORKS.findIndex((s) => s.network === a.network) -
                        SOCIAL_NETWORKS.findIndex((s) => s.network === b.network)
                    )
                    set({ networks })
                  }}
                />
              </Field>
            )
          })}
          <Field label="Alineación">
            <AlignPicker value={c.align ?? 'center'} onChange={(align) => set({ align })} />
          </Field>
          <p className="text-xs text-muted">Solo se muestran las redes con enlace. Los clicks se miden.</p>
        </>
      )}

      {block.type === 'video' && (
        <>
          <Field label="Enlace del vídeo (YouTube, Vimeo…)">
            <input
              className={input}
              value={c.video_url ?? ''}
              onChange={(e) => set({ video_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
          <Field label="Miniatura (opcional)">
            <input
              className={input}
              value={c.thumbnail_url ?? ''}
              onChange={(e) => set({ thumbnail_url: e.target.value })}
              placeholder="Para YouTube se detecta sola"
            />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align ?? 'center'} onChange={(align) => set({ align })} />
          </Field>
          <p className="text-xs text-muted">
            El email muestra la miniatura con un «Ver el vídeo»: al hacer click se abre el vídeo (y el click se mide).
          </p>
        </>
      )}

      {block.type === 'form' && (
        <>
          <Field label="Formulario de captura">
            <select
              className={input}
              value={c.form_id ?? ''}
              onChange={(e) => {
                const form = forms.find((f) => f.id === e.target.value)
                set({
                  form_id: form?.id,
                  url: form ? `${siteUrl}/form/${form.slug}` : undefined,
                  label: c.label || 'Rellenar el formulario',
                })
              }}
            >
              <option value="">Elige un formulario…</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Texto del botón">
            <input
              className={input}
              value={c.label ?? ''}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Rellenar el formulario"
            />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align ?? 'center'} onChange={(align) => set({ align })} />
          </Field>
          {forms.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No tienes formularios todavía: créalos en Automatizaciones.
            </p>
          )}
        </>
      )}

      {block.type === 'html' && (
        <>
          <Field label="Código HTML">
            <textarea
              className={`${input} min-h-40 resize-y font-mono text-xs`}
              value={c.html ?? ''}
              onChange={(e) => set({ html: e.target.value })}
              placeholder={'<p>Tu HTML…</p>'}
            />
          </Field>
          <p className="text-xs text-muted">
            Para usuarios avanzados: se inserta tal cual en el email (limpiando scripts). Los
            enlaces de este bloque <strong>no cuentan clicks</strong>.
          </p>
        </>
      )}
    </div>
  )
}
