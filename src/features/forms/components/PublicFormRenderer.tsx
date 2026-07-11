'use client'

import { useEffect, useRef, useState } from 'react'
import { uid } from '@/shared/lib/uid'
import { submitForm } from '@/actions/forms'
import type { Form } from '@/types/database'
import { isInputField } from '../services/schema'
import { containerStyle, fieldRows, FieldRow, SubmitButtonView } from './form-render'

const VISITOR_KEY = 'titan_vid'

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = uid().replace(/-/g, '')
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return uid().replace(/-/g, '') // localStorage bloqueado (cookies 3rd-party): id efímero
  }
}

export function PublicFormRenderer({ form, embed }: { form: Form; embed: boolean }) {
  const { schema, styles, settings } = form
  const rootRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successHtml, setSuccessHtml] = useState<string | null>(null)

  // Vista (medición) + auto-alto si va embebido en un iframe
  useEffect(() => {
    const visitorId = getVisitorId()
    fetch('/api/forms/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form_id: form.id, visitor_id: visitorId }),
      keepalive: true,
    }).catch(() => {})

    if (!embed) return
    const postHeight = () => {
      const h = rootRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent?.postMessage({ type: 'titan-form-height', slug: form.slug, height: h }, '*')
    }
    postHeight()
    const ro = new ResizeObserver(postHeight)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [form.id, form.slug, embed])

  // Re-emitir alto cuando aparece el mensaje de éxito
  useEffect(() => {
    if (!embed || !successHtml) return
    const h = rootRef.current?.scrollHeight ?? 0
    window.parent?.postMessage({ type: 'titan-form-height', slug: form.slug, height: h }, '*')
  }, [successHtml, embed, form.slug])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const values: Record<string, unknown> = {}
    for (const f of schema.fields) {
      if (!isInputField(f.type)) continue
      if (f.type === 'checkbox_group') values[f.key] = fd.getAll(f.key).map(String)
      else values[f.key] = fd.get(f.key) ?? ''
    }

    const res = await submitForm({ slug: form.slug, values, visitorId: getVisitorId() })
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }
    if (res.action === 'redirect' && res.redirect_url) {
      // Si va embebido, saca al visitante de la página anfitriona (gesto del usuario)
      try {
        if (embed && window.top) window.top.location.assign(res.redirect_url)
        else window.location.assign(res.redirect_url)
      } catch {
        window.location.assign(res.redirect_url)
      }
      return
    }
    setSuccessHtml(res.message_html || '<p>¡Gracias! Hemos recibido tus datos.</p>')
  }

  const rows = fieldRows(schema.fields)

  return (
    <div ref={rootRef} className={embed ? '' : 'py-10 px-4'}>
      <div className="mx-auto w-full" style={{ maxWidth: styles.width }}>
        {successHtml ? (
          <div
            className="border p-8 text-center [&_a]:underline"
            style={containerStyle(styles)}
            dangerouslySetInnerHTML={{ __html: successHtml }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="border p-6 space-y-4" style={containerStyle(styles)}>
            {form.description && <p className="text-sm opacity-70 -mt-1 mb-2">{form.description}</p>}
            {rows.map((row, ri) => (
              <div key={ri} className={row.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
                {row.map((field) => (
                  <FieldRow key={field.id} field={field} styles={styles} interactive />
                ))}
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="pt-1">
              <SubmitButtonView styles={styles} label={settings.submit_label || 'Enviar'} loading={loading} />
            </div>
          </form>
        )}
        {!embed && <p className="text-center text-xs opacity-50 mt-6">Powered by GHL Titan</p>}
      </div>
    </div>
  )
}
