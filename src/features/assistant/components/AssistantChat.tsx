'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Send, Sparkles } from 'lucide-react'
import { ui } from '@/shared/lib/ui'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  '¿Cuántos contactos tenemos y qué etiquetas hay?',
  'Escríbeme una newsletter para reactivar contactos fríos',
  '¿Qué campañas hemos enviado y cuál tuvo más clicks?',
  'Te cuento cómo es la marca para que la memorices',
]

/** Enlaza rutas internas (/marketing/...) y URLs http(s) dentro del texto del asistente. */
function renderWithLinks(text: string) {
  const parts = text.split(/((?:https?:\/\/[^\s)]+)|(?:\/marketing\/campaigns\/[a-z0-9-]+))/gi)
  return parts.map((part, i) => {
    if (/^\/marketing\//i.test(part)) {
      return (
        <Link key={i} href={part} className="text-primary underline underline-offset-2">
          {part}
        </Link>
      )
    }
    if (/^https?:\/\//i.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
          {part}
        </a>
      )
    }
    return part
  })
}

export function AssistantChat() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    const history = [...messages, { role: 'user' as const, content }]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '')
        throw new Error(detail || `Error ${res.status}`)
      }

      setMessages([...history, { role: 'assistant', content: '' }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const current = acc
        setMessages([...history, { role: 'assistant', content: current }])
      }
      if (!acc.trim()) {
        setMessages([
          ...history,
          {
            role: 'assistant',
            content:
              'No me ha llegado texto de respuesta (puede ser un fallo puntual del modelo). Vuelve a intentarlo.',
          },
        ])
      }
      // La conversación puede haber creado borradores o memorias: refresca los datos del servidor
      router.refresh()
    } catch (err) {
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: `Ha fallado la conexión con el asistente (${(err as Error).message}). Prueba otra vez.`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${ui.card} flex flex-col h-[calc(100vh-8rem)]`}>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-soft flex items-center justify-center">
              <Sparkles size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">Tu copywriter con acceso a GHL Titan</p>
              <p className="text-sm text-muted mt-1 max-w-md">
                Conoce tus contactos y campañas, escribe newsletters y las deja como borrador
                en Marketing. Lo que aprenda de tu marca lo recuerda entre sesiones.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:text-fg hover:border-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-bg border border-border rounded-bl-sm'
              }`}
            >
              {m.role === 'assistant' ? renderWithLinks(m.content) : m.content}
              {m.role === 'assistant' && m.content === '' && (
                <span className="inline-flex gap-1 items-center text-muted">
                  Consultando
                  <span className="animate-pulse">…</span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="border-t border-border p-4 flex gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          rows={1}
          placeholder="Pídele una newsletter, pregunta por tus contactos…"
          className={`${ui.input} resize-none`}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={`${ui.buttonPrimary} px-4 disabled:opacity-50`}
          aria-label="Enviar"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
