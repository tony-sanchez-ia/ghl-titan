'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { addMemory, deleteMemory, resetMemory, updateMemory } from '@/actions/assistant'
import type { AssistantMemory } from '../services/memory'

export function MemoryPanel({ memories }: { memories: AssistantMemory[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await action()
      if (res.error) alert(res.error)
      router.refresh()
    })

  return (
    <div className={`${ui.card} p-4 flex flex-col gap-3 h-fit max-h-[calc(100vh-8rem)]`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Brain size={16} className="text-primary" />
          Memoria de marca
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => router.refresh()}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-bg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={14} />
          </button>
          {memories.length > 0 && (
            <button
              onClick={() => {
                if (confirm('¿Borrar TODA la memoria de marca? Esto no se puede deshacer.')) {
                  run(resetMemory)
                }
              }}
              className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-bg transition-colors"
              title="Resetear memoria"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted">
        Lo que el asistente recuerda entre sesiones. Él guarda cosas solo; tú puedes añadir,
        editar o borrar lo que quieras.
      </p>

      <div className="overflow-y-auto space-y-2">
        {memories.length === 0 && (
          <p className="text-xs text-muted italic py-2">
            Vacía. Cuéntale a tu asistente cómo es tu marca, o añade algo aquí abajo.
          </p>
        )}
        {memories.map((m) =>
          editingId === m.id ? (
            <div key={m.id} className="border border-primary rounded-lg p-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className={`${ui.input} text-xs`}
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-fg"
                  title="Cancelar"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={() => {
                    run(() => updateMemory(m.id, editContent))
                    setEditingId(null)
                  }}
                  className="p-1.5 rounded-lg text-primary hover:bg-primary-soft"
                  title="Guardar"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              className="group border border-border rounded-lg p-2.5 text-xs flex items-start gap-2"
            >
              <span className="flex-1 whitespace-pre-wrap">{m.content}</span>
              <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => {
                    setEditingId(m.id)
                    setEditContent(m.content)
                  }}
                  className="text-muted hover:text-fg"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => run(() => deleteMemory(m.id))}
                  className="text-muted hover:text-red-600"
                  title="Borrar"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const content = newContent.trim()
          if (!content) return
          run(() => addMemory(content))
          setNewContent('')
        }}
        className="flex gap-2 pt-1 border-t border-border"
      >
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Añadir recuerdo…"
          className={`${ui.input} text-xs`}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !newContent.trim()}
          className={`${ui.button} px-3 disabled:opacity-50`}
          aria-label="Añadir"
        >
          <Plus size={14} />
        </button>
      </form>
    </div>
  )
}
