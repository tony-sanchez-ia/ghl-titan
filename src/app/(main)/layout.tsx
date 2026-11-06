import type { Metadata } from 'next'
import { Sidebar } from '@/shared/components/sidebar'
import { BrandStyle } from '@/features/instance/components/BrandStyle'
import { getInstanceSettings, DEFAULT_BRAND_NAME } from '@/features/instance/services/instance-settings'

// El panel (main) es privado y muestra datos en vivo por petición: nunca se
// prerenderiza en el build (si no, el build intentaría conectar a la BD sin
// DATABASE_URL → ECONNREFUSED). force-dynamic en el layout cubre todas las hijas.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = await getInstanceSettings()
  const name = brandName ?? DEFAULT_BRAND_NAME
  return { title: { default: name, template: `%s — ${name}` } }
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getInstanceSettings()
  return (
    <div className="min-h-screen">
      <BrandStyle accentColor={settings.accentColor} />
      <Sidebar settings={settings} />
      <main className="ml-64 p-8">{children}</main>
    </div>
  )
}
