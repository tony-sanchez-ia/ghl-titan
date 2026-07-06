'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { RichTextInput } from '@/shared/components/rich-text-input'
import { rewriteBlockText } from '@/actions/funnels'
import type { Form, PageBlock, PageBlockConfig, PageSection, PageSectionConfig } from '@/types/database'

const BLOCK_LABELS: Record<PageBlock['type'], string> = {
  heading: 'Titular',
  text: 'Texto',
  image: 'Imagen',
  button: 'Botón CTA',
  video: 'Vídeo',
  form: 'Formulario',
  html: 'Código HTML (avanzado)',
  divider: 'Divisor',
  spacer: 'Espaciador',
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
  value: PageBlockConfig['align']
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

function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** html saneado del bloque de texto → texto plano para el prompt de la IA. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .trim()
}

/** Botón "Reescribir con IA" para bloques de titular/texto. */
function AiRewriteButton({
  funnelId,
  kind,
  current,
  onRewritten,
}: {
  funnelId: string
  kind: 'heading' | 'text'
  current: string
  onRewritten: (text: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function onClick() {
    setBusy(true)
    const res = await rewriteBlockText(funnelId, { current, kind })
    setBusy(false)
    if (res.error || !res.text) {
      alert(res.error ?? 'La IA no pudo reescribir el texto')
      return
    }
    onRewritten(res.text)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || !current.trim()}
      className={`${ui.button} w-full px-2.5 py-1.5 text-xs disabled:opacity-50`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {busy ? 'Reescribiendo…' : 'Reescribir con IA'}
    </button>
  )
}

/** Panel de ajustes del bloque de página seleccionado. */
export function PageBlockSettings({
  block,
  onChange,
  forms,
  funnelId,
  aiEnabled,
}: {
  block: PageBlock
  onChange: (config: PageBlockConfig) => void
  forms: Form[]
  funnelId: string
  aiEnabled: boolean
}) {
  const c = block.config
  const set = (patch: PageBlockConfig) => onChange({ ...c, ...patch })
  const input = `${ui.input} text-sm`
  // RichTextInput solo pinta al montar: se remonta SOLO cuando la IA reescribe
  const [aiVersion, setAiVersion] = useState(0)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{BLOCK_LABELS[block.type]}</h3>

      {block.type === 'heading' && (
        <>
          <Field label="Texto del titular">
            <textarea
              className={`${input} min-h-20 resize-y`}
              value={c.text ?? ''}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="El titular que engancha…"
            />
          </Field>
          <Field label="Jerarquía">
            <select
              className={input}
              value={c.level ?? 1}
              onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 })}
            >
              <option value={1}>Principal (H1)</option>
              <option value={2}>Sección (H2)</option>
              <option value={3}>Apartado (H3)</option>
            </select>
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
          {aiEnabled && (
            <AiRewriteButton
              funnelId={funnelId}
              kind="heading"
              current={c.text ?? ''}
              onRewritten={(text) => set({ text })}
            />
          )}
        </>
      )}

      {block.type === 'text' && (
        <>
          <Field label="Texto (negrita, cursiva y enlaces)">
            <RichTextInput
              key={`${block.id}:${aiVersion}`}
              value={c.html ?? ''}
              onChange={(html) => set({ html })}
            />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
          {aiEnabled && (
            <AiRewriteButton
              funnelId={funnelId}
              kind="text"
              current={htmlToPlain(c.html ?? '')}
              onRewritten={(text) => {
                set({ html: escText(text).replace(/\n/g, '<br>') })
                setAiVersion((v) => v + 1)
              }}
            />
          )}
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
            <input className={input} value={c.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Quiero saber más" />
          </Field>
          <Field label="Enlace de destino">
            <input className={input} value={c.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://… o /paso-siguiente" />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align} onChange={(align) => set({ align })} />
          </Field>
          <p className="text-xs text-muted">Los clicks de este botón se miden en las estadísticas del embudo.</p>
        </>
      )}

      {block.type === 'video' && (
        <Field label="Enlace del vídeo (YouTube, Vimeo…)">
          <input
            className={input}
            value={c.video_url ?? ''}
            onChange={(e) => set({ video_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
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
                  form_slug: form?.slug,
                  label: c.label || 'Enviar',
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
            <input className={input} value={c.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="Enviar" />
          </Field>
          <Field label="Alineación">
            <AlignPicker value={c.align ?? 'center'} onChange={(align) => set({ align })} />
          </Field>
          {forms.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No tienes formularios todavía: créalos en Automatizaciones.
            </p>
          )}
          <p className="text-xs text-muted">
            Quien lo rellene se convierte en contacto del CRM y dispara sus automatizaciones.
          </p>
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
            Para usuarios avanzados: se inserta en la página (limpiando scripts).
          </p>
        </>
      )}

      {block.type === 'divider' && <p className="text-sm text-muted">Una línea separadora. No tiene ajustes.</p>}

      {block.type === 'spacer' && (
        <Field label={`Altura: ${c.height ?? 40}px`}>
          <input
            type="range"
            min={4}
            max={240}
            step={4}
            value={c.height ?? 40}
            onChange={(e) => set({ height: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      )}
    </div>
  )
}

/** Panel de ajustes de la sección de página seleccionada. */
export function PageSectionSettings({
  section,
  onChange,
}: {
  section: PageSection
  onChange: (config: PageSectionConfig) => void
}) {
  const c = section.config
  const set = (patch: PageSectionConfig) => onChange({ ...c, ...patch })

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Sección</h3>
      <Field label="Color de fondo">
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
          >
            Sin fondo propio
          </button>
        </div>
      </Field>
      <Field label={`Espacio vertical: ${c.padding ?? 48}px`}>
        <input
          type="range"
          min={0}
          max={160}
          step={8}
          value={c.padding ?? 48}
          onChange={(e) => set({ padding: Number(e.target.value) })}
          className="w-full"
        />
      </Field>
      <p className="text-xs text-muted">
        La sección ocupa todo el ancho; su contenido queda centrado en columnas.
      </p>
    </div>
  )
}
