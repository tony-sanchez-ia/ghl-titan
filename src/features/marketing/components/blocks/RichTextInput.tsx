'use client'

import { useEffect, useRef } from 'react'
import { Bold, Italic, Link2, RemoveFormatting } from 'lucide-react'
import { sanitizeInlineHtml } from '../../services/sanitize'

/**
 * Editor de texto con formato SIN librerías: contentEditable + execCommand
 * (deprecado pero universal). El HTML se sanea aquí para el preview y OTRA VEZ
 * en el servidor al guardar (nunca se confía en el cliente).
 */
export function RichTextInput({
  value,
  onChange,
}: {
  value: string // HTML saneado
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Pintar SOLO al montar: re-inyectar el HTML saneado en cada tecla movería el cursor.
  // Quien lo use debe pasar key={block.id} para remontar al cambiar de bloque.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emit() {
    if (!ref.current) return
    onChange(sanitizeInlineHtml(ref.current.innerHTML))
  }

  function cmd(command: string, arg?: string) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  function onLink() {
    const url = prompt('Dirección del enlace (https://…):', 'https://')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      alert('El enlace debe empezar por http:// o https://')
      return
    }
    cmd('createLink', url)
  }

  const btn =
    'p-1.5 rounded-md text-muted hover:text-fg hover:bg-bg transition-colors'
  // mousedown preventDefault: si el botón roba el foco, la selección del texto se pierde
  const keepSelection = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="rounded-lg border border-border bg-card focus-within:border-primary">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <button type="button" onMouseDown={keepSelection} onClick={() => cmd('bold')} className={btn} title="Negrita">
          <Bold size={14} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => cmd('italic')} className={btn} title="Cursiva">
          <Italic size={14} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={onLink} className={btn} title="Enlace">
          <Link2 size={14} />
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => cmd('removeFormat')} className={btn} title="Quitar formato">
          <RemoveFormatting size={14} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="min-h-36 px-3 py-2 text-sm outline-none whitespace-pre-wrap break-words"
      />
    </div>
  )
}
