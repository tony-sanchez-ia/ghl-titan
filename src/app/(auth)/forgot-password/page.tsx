import Link from 'next/link'
import { ForgotPasswordForm } from '@/features/auth/components'
import { ui } from '@/shared/lib/ui'

export default function ForgotPasswordPage() {
  return (
    <div className={`${ui.card} w-full max-w-md p-8`}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        <p className="mt-2 text-muted">Te enviaremos un enlace por email</p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-primary hover:underline">
          Volver al login
        </Link>
      </p>
    </div>
  )
}
