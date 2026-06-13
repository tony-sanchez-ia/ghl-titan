import Link from 'next/link'
import { Plus, Zap, FileInput, Mail } from 'lucide-react'
import { ui } from '@/shared/lib/ui'
import { listForms, listAutomations } from '@/features/automations/services/queries'

export default async function AutomationsPage() {
  const [forms, automations] = await Promise.all([listForms(), listAutomations()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Automatizaciones</h1>
        <p className="mt-1 text-muted">Formularios de captura y secuencias de email.</p>
      </div>

      <div className={`${ui.card} p-4 text-sm text-muted`}>
        <p>
          <strong className="text-fg">Cómo funciona:</strong> creas un formulario, lo vinculas a una
          secuencia de emails, y cuando alguien lo rellena se da de alta como contacto y empieza a
          recibir la secuencia automáticamente.
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
                <p className="text-sm text-muted mt-2 inline-flex items-center gap-1.5"><Mail size={14} /> {a.stepCount} emails</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Formularios */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><FileInput size={18} /> Formularios</h2>
          <Link href="/automations/forms/new" className={`${ui.button} px-3 py-2 text-sm`}>
            <Plus size={16} /> Nuevo formulario
          </Link>
        </div>
        {forms.length === 0 ? (
          <div className={`${ui.card} p-8 text-center text-muted`}>Aún no tienes formularios.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forms.map((f) => (
              <Link key={f.id} href={`/automations/forms/${f.id}`} className={`${ui.card} p-5 hover:border-primary transition-colors`}>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="text-sm text-muted mt-1">/form/{f.slug}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
