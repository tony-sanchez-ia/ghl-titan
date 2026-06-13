import Link from 'next/link'
import { SignupForm } from '@/features/auth/components'
import { ui } from '@/shared/lib/ui'

export default function SignupPage() {
  return (
    <div className={`${ui.card} w-full max-w-md p-8`}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <p className="mt-2 text-muted">Cuenta de administrador de la instancia</p>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Entra
        </Link>
      </p>
    </div>
  )
}
