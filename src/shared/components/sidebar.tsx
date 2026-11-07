'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, GraduationCap, Zap, Megaphone, Sparkles, Filter, FileText, Globe, Settings, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { signout } from '@/actions/auth'
import { BrandHeader } from '@/features/instance/components/BrandHeader'
import type { InstanceSettings, ModuleKey } from '@/features/instance/types'

type NavItem = { href: string; label: string; icon: LucideIcon; module?: ModuleKey }

const NAV_MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/calendars', label: 'Agenda', icon: Calendar, module: 'calendars' },
  { href: '/courses', label: 'Cursos', icon: GraduationCap, module: 'courses' },
  { href: '/automations', label: 'Automatizaciones', icon: Zap },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/assistant', label: 'Asistente IA', icon: Sparkles },
]

// Apartado "Web": todo lo que se publica de cara al público
const NAV_WEB: NavItem[] = [
  { href: '/funnels', label: 'Embudos', icon: Filter, module: 'funnels' },
  { href: '/websites', label: 'Sitios web', icon: Globe, module: 'websites' },
  { href: '/forms', label: 'Formularios', icon: FileText, module: 'forms' },
]

const NAV_TAIL: NavItem[] = [{ href: '/settings', label: 'Ajustes', icon: Settings }]

export function Sidebar({ settings }: { settings: InstanceSettings }) {
  const pathname = usePathname()
  const enabled = (item: NavItem) => !item.module || settings.modules[item.module]
  const navMain = NAV_MAIN.filter(enabled)
  const navWeb = NAV_WEB.filter(enabled)

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const active = pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-primary-soft text-primary' : 'text-muted hover:text-fg hover:bg-bg'
        }`}
      >
        <Icon size={18} />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col">
      <div className="px-6 py-5 border-b border-border">
        <BrandHeader brand={settings} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navMain.map(renderItem)}

        {navWeb.length > 0 && (
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">Web</p>
        )}
        {navWeb.map(renderItem)}

        <div className="pt-4">{NAV_TAIL.map(renderItem)}</div>
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-2">
        <ThemeToggle />
        <form action={signout}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-fg hover:bg-bg transition-colors w-full"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
