import { queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { ProfileForm } from '@/features/settings/components/ProfileForm'
import { PasswordForm } from '@/features/settings/components/PasswordForm'
import { OutlookConnectionCard } from '@/features/integrations/components/OutlookConnectionCard'
import { GoogleConnectionCard } from '@/features/integrations/components/GoogleConnectionCard'
import { getOutlookConnection } from '@/features/integrations/services/outlook-auth'
import { getGoogleConnection, isGoogleConfigured } from '@/features/integrations/services/google-auth'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>
}) {
  const session = await getSession()
  const [user, outlook, google, params] = await Promise.all([
    session
      ? queryOne<{ full_name: string | null; email: string }>(
          'select full_name, email from users where id = $1',
          [session.sub]
        )
      : Promise.resolve(null),
    getOutlookConnection(),
    getGoogleConnection(),
    searchParams,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-muted">Tu perfil y la configuración de la instancia.</p>
      </div>

      <ProfileForm fullName={user?.full_name ?? null} email={user?.email ?? ''} />
      <PasswordForm />
      <OutlookConnectionCard connection={outlook}>
        <GoogleConnectionCard
          connection={google}
          configured={isGoogleConfigured()}
          result={params.google ?? null}
        />
      </OutlookConnectionCard>
    </div>
  )
}
