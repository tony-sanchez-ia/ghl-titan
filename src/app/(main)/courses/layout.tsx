import { requireModule } from '@/features/instance/services/instance-settings'

// Módulo activable desde Ajustes: apagado → el panel redirige al Inicio (lo público sigue vivo).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule('courses')
  return children
}
