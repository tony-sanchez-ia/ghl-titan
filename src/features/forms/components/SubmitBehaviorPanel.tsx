'use client'

import { useState } from 'react'
import { MessageSquare, Redo2, X, Zap } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { RichTextInput } from '@/shared/components/rich-text-input'
import type { Automation, FormSettings } from '@/types/database'

export function SubmitBehaviorPanel({
  settings,
  onChange,
  automations,
  linkedAutomationIds,
  onToggleAutomation,
}: {
  settings: FormSettings
  onChange: (patch: Partial<FormSettings>) => void
  automations: Pick<Automation, 'id' | 'name' | 'status'>[]
  linkedAutomationIds: string[]
  onToggleAutomation: (automationId: string, link: boolean) => void
}) {
  const linked = new Set(linkedAutomationIds)

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold text-sm">Al enviar el formulario</h3>
        <div className="grid grid-cols-2 gap-2">
          <ActionCard
            active={settings.submit_action === 'message'}
            onClick={() => onChange({ submit_action: 'message' })}
            icon={<MessageSquare size={16} />}
            title="Mostrar mensaje"
            desc="Un mensaje de gracias en la misma página"
          />
          <ActionCard
            active={settings.submit_action === 'redirect'}
            onClick={() => onChange({ submit_action: 'redirect' })}
            icon={<Redo2 size={16} />}
            title="Redirigir"
            desc="Llevar a otra página (gracias, oferta…)"
          />
        </div>

        {settings.submit_action === 'message' ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">Mensaje de gracias</span>
            <RichTextInput
              key="msg"
              value={settings.message_html ?? ''}
              onChange={(html) => onChange({ message_html: html })}
            />
          </label>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">URL de destino</span>
            <input
              className={`${ui.input} text-sm`}
              value={settings.redirect_url ?? ''}
              onChange={(e) => onChange({ redirect_url: e.target.value })}
              placeholder="https://tu-web.com/gracias"
            />
            <span className="block text-[11px] text-muted">Debe empezar por http:// o https://</span>
          </label>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">Texto del botón de envío</span>
          <input
            className={`${ui.input} text-sm max-w-xs`}
            value={settings.submit_label}
            onChange={(e) => onChange({ submit_label: e.target.value })}
          />
        </label>
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <h3 className="font-semibold text-sm">Etiquetas al contacto</h3>
        <p className="text-xs text-muted">Se añaden al contacto cuando envía el formulario (para segmentar).</p>
        <TagEditor tags={settings.add_tags} onChange={(add_tags) => onChange({ add_tags })} />
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
          <Zap size={15} className="text-primary" /> Automatizaciones
        </h3>
        <p className="text-xs text-muted">
          Inscribe al contacto en estas secuencias al enviar. Solo las secuencias activas se ejecutan.
        </p>
        {automations.length === 0 ? (
          <p className="text-sm text-muted">
            No tienes automatizaciones todavía. Créalas en la sección Automatizaciones.
          </p>
        ) : (
          <div className="space-y-1.5">
            {automations.map((a) => (
              <label key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={linked.has(a.id)}
                  onChange={(e) => onToggleAutomation(a.id, e.target.checked)}
                />
                <span className="flex-1">{a.name}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {a.status === 'active' ? 'Activa' : 'Borrador'}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ActionCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
        active ? 'border-primary bg-primary-soft' : 'border-border hover:bg-bg'
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 font-medium text-sm ${active ? 'text-primary' : ''}`}>
        {icon} {title}
      </span>
      <span className="block text-xs text-muted mt-0.5">{desc}</span>
    </button>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft text-primary px-2.5 py-1 text-xs font-medium">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:opacity-70">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 max-w-xs">
        <input
          className={`${ui.input} text-sm`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Escribe una etiqueta y Enter"
        />
        <button onClick={add} className={`${ui.button} px-3 py-2 text-sm`}>
          Añadir
        </button>
      </div>
    </div>
  )
}
