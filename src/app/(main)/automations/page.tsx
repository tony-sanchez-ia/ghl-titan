import Link from 'next/link'
import { Plus, Zap, Mail } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { listAutomations } from '@/features/automations/services/queries'

export default async function AutomationsPage() {
  const automations = await listAutomations()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Automatizaciones</h1>
        <p className="mt-1 text-muted">Formularios de captura y secuencias de email.</p>
      </div>

      <div className={`${ui.card} p-4 text-sm text-muted`}>
        <p>
          <strong className="text-fg">Cómo funciona:</strong> creas un flujo de trabajo y eliges
          cuándo empieza (formulario enviado, cita reservada o etiqueta añadida). El contacto
          recorre los pasos: emails, esperas, etiquetas y ramas según haga click o no.
        </p>
      </div>

      {/* Automatizaciones */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Zap size={18} /> Secuencias</h2>
          <Link href="/automations/new" className={`${ui.buttonPrimary} px-3 py-2 text-sm`}>
            <Plus size={16} /> Nueva secuencia
          </Link>
        </div>
        {automations.length === 0 ? (
          <div className={`${ui.card} p-8 text-center text-muted`}>Aún no tienes secuencias.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {automations.map((a) => (
              <Link key={a.id} href={`/automations/${a.id}`} className={`${ui.card} p-5 hover:border-primary transition-colors`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{a.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-bg text-muted'}`}>
                    {a.status === 'active' ? 'Activa' : 'Borrador'}
                  </span>
                </div>
                <p className="text-sm text-muted mt-2 inline-flex items-center gap-1.5">
                  <Mail size={14} /> {a.nodeCount} pasos
                  {a.activeEnrollments > 0 && <span>· {a.activeEnrollments} en curso</span>}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className={`${ui.card} p-4 text-sm text-muted`}>
        Los <strong className="text-fg">formularios</strong> de captación ahora viven en{' '}
        <Link href="/forms" className="text-primary hover:underline">Web → Formularios</Link>. Desde
        el editor de cada formulario puedes vincularlo a una secuencia, o elígelo como disparador al
        crear una secuencia.
      </div>
    </div>
  )
}
