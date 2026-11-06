import Link from 'next/link'
import { LoginForm } from '@/features/auth/components'
import { ui } from '@/shared/lib/ui'
import { BrandHeader } from '@/features/instance/components/BrandHeader'
import { getInstanceSettings } from '@/features/instance/services/instance-settings'

export default async function LoginPage() {
  const brand = await getInstanceSettings()
  return (
    <div className={`${ui.card} w-full max-w-md p-8`}>
      <div className="text-center mb-8">
        <BrandHeader brand={brand} size="lg" />
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
