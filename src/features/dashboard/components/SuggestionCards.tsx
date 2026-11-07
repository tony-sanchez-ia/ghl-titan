import Link from 'next/link'
import { ArrowRight, Send, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ui } from '@/shared/lib/ui'

type Suggestion = { icon: LucideIcon; title: string; text: string; cta: string; href: string }

/** Atajos de siguiente paso. Solo se muestran los de módulos activos. */
export function SuggestionCards({ formsEnabled }: { formsEnabled: boolean }) {
  const items: Suggestion[] = [
    {
      icon: UsersRound,
      title: '¿Tienes nuevos contactos que organizar?',
      text: 'Etiquétalos para enviar campañas a cada grupo, o importa una lista desde GoHighLevel o Brevo.',
      cta: 'Ir a contactos',
      href: '/contacts',
    },
  ]
  if (formsEnabled) {
    items.push({
      icon: Send,
      title: 'Amplía tu alcance con formularios de suscripción',
      text: 'Convierte a los visitantes de tu web en suscriptores y recoge sus datos.',
      cta: 'Crear formulario',
      href: '/forms',
    })
  }

  return (
    <div className={`grid grid-cols-1 ${items.length > 1 ? 'md:grid-cols-2' : ''} gap-5`}>
      {items.map((s) => {
        const Icon = s.icon
        return (
          <div key={s.href} className={`${ui.card} p-5 flex flex-col gap-2`}>
            <Icon size={24} className="text-primary" />
            <h3 className="font-semibold mt-1">{s.title}</h3>
            <p className="text-sm text-muted flex-1">{s.text}</p>
            <Link href={s.href} className="self-end text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline">
              {s.cta} <ArrowRight size={14} />
            </Link>
          </div>
        )
      })}
    </div>
  )
}
