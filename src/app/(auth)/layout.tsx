import type { Metadata } from 'next'
import { BrandStyle } from '@/features/instance/components/BrandStyle'
import { getInstanceSettings, DEFAULT_BRAND_NAME } from '@/features/instance/services/instance-settings'

// Lee la marca de la BD por petición: sin esto el build intentaría prerenderizar login/signup.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = await getInstanceSettings()
  return { title: brandName ?? DEFAULT_BRAND_NAME }
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { accentColor } = await getInstanceSettings()
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <BrandStyle accentColor={accentColor} />
      {children}
    </div>
  )
}
