import Link from 'next/link'
import { LoginForm } from '@/features/auth/components'
import { ui } from '@/shared/lib/ui'

export default function LoginPage() {
  return (
    <div className={`${ui.card} w-full max-w-md p-8`}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">
          GHL <span className="text-primary">Titan</span>
        </h1>
        <p className="mt-2 text-muted">Entra en tu cuenta</p>
      </div>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  )
}
