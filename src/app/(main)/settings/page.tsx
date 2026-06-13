import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/features/settings/components/ProfileForm'
import { PasswordForm } from '@/features/settings/components/PasswordForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-muted">Tu perfil y la configuración de la instancia.</p>
      </div>

      <ProfileForm fullName={profile?.full_name ?? null} email={profile?.email ?? user?.email ?? ''} />
      <PasswordForm />
    </div>
  )
}
