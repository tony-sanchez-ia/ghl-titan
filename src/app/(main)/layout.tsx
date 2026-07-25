import { Sidebar } from '@/shared/components/sidebar'

// El panel (main) es privado y muestra datos en vivo por petición: nunca se
// prerenderiza en el build (si no, el build intentaría conectar a la BD sin
// DATABASE_URL → ECONNREFUSED). force-dynamic en el layout cubre todas las hijas.
export const dynamic = 'force-dynamic'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-64 p-8">{children}</main>
    </div>
  )
}
