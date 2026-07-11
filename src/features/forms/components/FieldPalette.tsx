'use client'

import {
  AlignLeft, Building2, Calendar, CheckSquare, ChevronDownSquare, CircleDot,
  EyeOff, Hash, Heading, ListChecks, Mail, Phone, Pilcrow, Type, User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FIELD_PRESETS, type FieldGroup, type FieldPreset } from '../services/schema'

const ICONS: Record<string, LucideIcon> = {
  full_name: User, first_name: User, last_name: User, email: Mail, phone: Phone,
  business_name: Building2, text: Type, textarea: AlignLeft, number: Hash, date: Calendar,
  select: ChevronDownSquare, radio: CircleDot, checkbox_group: ListChecks, consent: CheckSquare,
  heading: Heading, paragraph: Pilcrow, hidden: EyeOff,
}

const GROUPS: { key: FieldGroup; label: string }[] = [
  { key: 'personal', label: 'Información personal' },
  { key: 'campos', label: 'Campos' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'avanzado', label: 'Avanzado' },
]

export function FieldPalette({ onAdd }: { onAdd: (preset: FieldPreset) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Añadir campo</h3>
      {GROUPS.map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{g.label}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FIELD_PRESETS.filter((p) => p.group === g.key).map((p) => {
              const Icon = ICONS[p.presetKey] ?? Type
              return (
                <button
                  key={p.presetKey}
                  onClick={() => onAdd(p)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-left hover:border-primary hover:bg-bg transition-colors"
                  title={`Añadir «${p.label}»`}
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="truncate">{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
