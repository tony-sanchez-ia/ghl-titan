import { UpdatePasswordForm } from '@/features/auth/components'
import { ui } from '@/shared/lib/ui'

export default function UpdatePasswordPage() {
  return (
    <div className={`${ui.card} w-full max-w-md p-8`}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Nueva contraseña</h1>
        <p className="mt-2 text-muted">Escribe tu nueva contraseña</p>
      </div>

      <UpdatePasswordForm />
    </div>
  )
}
