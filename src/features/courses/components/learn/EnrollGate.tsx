'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ui } from '@/shared/lib/ui'
import { enrollStudent } from '@/actions/courses'

export function EnrollGate({
  slug,
  title,
  description,
  coverUrl,
}: {
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('slug', slug)
    const res = await enrollStudent(formData)
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`${ui.card} w-full max-w-md overflow-hidden`}>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={title} className="w-full aspect-video object-cover" />
        )}
        <div className="p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted mt-2 text-sm">{description}</p>}
          <form action={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Tu nombre</label>
              <input id="name" name="name" required className={ui.input} />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Tu email</label>
              <input id="email" name="email" type="email" required className={ui.input} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className={`${ui.buttonPrimary} w-full px-4 py-2.5 disabled:opacity-50`}>
              {loading ? 'Accediendo...' : 'Acceder al curso'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
