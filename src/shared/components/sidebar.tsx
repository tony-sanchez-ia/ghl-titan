'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, GraduationCap, Zap, Settings, LogOut } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { signout } from '@/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/calendars', label: 'Agenda', icon: Calendar },
  { href: '/courses', label: 'Cursos', icon: GraduationCap },
  { href: '/automations', label: 'Automatizaciones', icon: Zap },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-lg font-bold tracking-tight">
          GHL <span className="text-primary">Titan</span>
        </h2>
        <p className="text-muted text-xs mt-0.5">Titanic Factory</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted hover:text-fg hover:bg-bg'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
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
