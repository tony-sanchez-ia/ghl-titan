import Link from 'next/link'
import { ui } from '@/shared/lib/ui'

export default function CheckEmailPage() {
  return (
    <div className={`${ui.card} w-full max-w-md p-8 text-center`}>
      <h1 className="text-2xl font-bold">Revisa tu email</h1>
      <p className="mt-4 text-muted">
        Te hemos enviado un enlace de confirmación. Ábrelo para completar tu registro.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block text-primary hover:underline"
      >
        Volver al login
      </Link>
    </div>
  )
}
