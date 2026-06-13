'use client'

import { Award, Printer } from 'lucide-react'
import { ui } from '@/shared/lib/ui'

export function Certificate({
  studentName,
  courseTitle,
  dateLabel,
}: {
  studentName: string
  courseTitle: string
  dateLabel: string
}) {
  return (
    <div className="min-h-screen bg-bg py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4 print:hidden">
          <button onClick={() => window.print()} className={`${ui.button} px-4 py-2 text-sm`}>
            <Printer size={16} /> Imprimir / Guardar PDF
          </button>
        </div>

        <div className="bg-white text-slate-900 border-[6px] border-double border-slate-800 rounded-lg p-12 text-center shadow-sm">
          <Award size={56} className="mx-auto text-amber-500" />
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-slate-500">Certificado de aprovechamiento</p>
          <p className="mt-8 text-slate-600">Se certifica que</p>
          <h1 className="mt-2 text-3xl font-bold">{studentName}</h1>
          <p className="mt-6 text-slate-600">ha completado con éxito el curso</p>
          <h2 className="mt-2 text-xl font-semibold">{courseTitle}</h2>
          <p className="mt-10 text-sm text-slate-500">{dateLabel}</p>
          <div className="mt-10 flex items-center justify-between">
            <div className="text-left">
              <div className="w-40 border-t border-slate-400" />
              <p className="text-xs text-slate-500 mt-1">GHL Titan · Titanic Factory</p>
            </div>
            <p className="font-bold text-lg">GHL <span className="text-blue-600">Titan</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
