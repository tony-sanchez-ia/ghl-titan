import { uid } from '@/shared/lib/uid'
import {
  CONTACT_FIELD_KEYS,
  type FieldType,
  type Form,
  type FormField,
  type FormSchema,
  type FormSettings,
  type FormStyles,
} from '@/types/database'

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FORM_STYLES: FormStyles = {
  theme: 'clean',
  background_color: '#ffffff',
  text_color: '#0f172a',
  button_color: '#2563eb',
  button_text_color: '#ffffff',
  border_color: '#e2e8f0',
  border_width: 1,
  border_radius: 12,
  field_radius: 8,
  width: 560,
  label_align: 'top',
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  submit_label: 'Enviar',
  submit_action: 'message',
  message_html: '<p>¡Gracias! Hemos recibido tus datos. Te escribiremos muy pronto.</p>',
  redirect_url: '',
  add_tags: [],
}

/** Presets de tema aplicables desde el panel de estilos (parten de los defaults). */
export const FORM_THEMES: Record<'clean' | 'card' | 'minimal', Partial<FormStyles>> = {
  clean: {
    theme: 'clean',
    background_color: '#ffffff',
    text_color: '#0f172a',
    button_color: '#2563eb',
    button_text_color: '#ffffff',
    border_color: '#e2e8f0',
    border_width: 1,
    border_radius: 12,
    field_radius: 8,
  },
  card: {
    theme: 'card',
    background_color: '#f8fafc',
    text_color: '#0f172a',
    button_color: '#0f172a',
    button_text_color: '#ffffff',
    border_color: '#e2e8f0',
    border_width: 1,
    border_radius: 20,
    field_radius: 10,
  },
  minimal: {
    theme: 'minimal',
    background_color: '#ffffff',
    text_color: '#111827',
    button_color: '#111827',
    button_text_color: '#ffffff',
    border_color: '#d1d5db',
    border_width: 0,
    border_radius: 6,
    field_radius: 4,
  },
}

export function defaultFormSchema(): FormSchema {
  return {
    version: 1,
    fields: [
      { id: uid(), type: 'text', key: 'full_name', label: 'Nombre', placeholder: 'Tu nombre', required: true, width: 'full' },
      { id: uid(), type: 'email', key: 'email', label: 'Email', placeholder: 'tu@email.com', required: true, width: 'full' },
    ],
  }
}

// ── Clasificación de campos ──────────────────────────────────────────────────

/** Campos que solo muestran contenido y NO recogen datos. */
export function isContentField(type: FieldType): boolean {
  return type === 'heading' || type === 'paragraph'
}

/** Campos cuyo valor se recoge y guarda en el envío (incluye 'hidden'). */
export function isInputField(type: FieldType): boolean {
  return !isContentField(type)
}

export function needsOptions(type: FieldType): boolean {
  return type === 'select' || type === 'radio' || type === 'checkbox_group'
}

export function isReservedKey(key: string): boolean {
  return (CONTACT_FIELD_KEYS as readonly string[]).includes(key)
}

// ── Paleta de campos ─────────────────────────────────────────────────────────

export type FieldGroup = 'personal' | 'campos' | 'contenido' | 'avanzado'

export interface FieldPreset {
  presetKey: string
  label: string
  group: FieldGroup
  template: Omit<FormField, 'id'>
}

const DEFAULT_OPTIONS = [
  { label: 'Opción 1', value: 'opcion-1' },
  { label: 'Opción 2', value: 'opcion-2' },
]

export const FIELD_PRESETS: FieldPreset[] = [
  // Información personal (mapean a contacts)
  { presetKey: 'full_name', label: 'Nombre completo', group: 'personal', template: { type: 'text', key: 'full_name', label: 'Nombre completo', placeholder: 'Tu nombre', required: true, width: 'full' } },
  { presetKey: 'first_name', label: 'Nombre', group: 'personal', template: { type: 'text', key: 'first_name', label: 'Nombre', placeholder: 'Nombre', width: 'half' } },
  { presetKey: 'last_name', label: 'Apellidos', group: 'personal', template: { type: 'text', key: 'last_name', label: 'Apellidos', placeholder: 'Apellidos', width: 'half' } },
  { presetKey: 'email', label: 'Email', group: 'personal', template: { type: 'email', key: 'email', label: 'Email', placeholder: 'tu@email.com', required: true, width: 'full' } },
  { presetKey: 'phone', label: 'Teléfono', group: 'personal', template: { type: 'phone', key: 'phone', label: 'Teléfono', placeholder: '+34 600 000 000', width: 'full' } },
  { presetKey: 'business_name', label: 'Empresa', group: 'personal', template: { type: 'text', key: 'business_name', label: 'Empresa', placeholder: 'Tu empresa u organización', width: 'full' } },
  // Campos genéricos
  { presetKey: 'text', label: 'Texto corto', group: 'campos', template: { type: 'text', key: 'campo', label: 'Texto', width: 'full' } },
  { presetKey: 'textarea', label: 'Texto largo', group: 'campos', template: { type: 'textarea', key: 'mensaje', label: 'Mensaje', width: 'full' } },
  { presetKey: 'number', label: 'Número', group: 'campos', template: { type: 'number', key: 'numero', label: 'Número', width: 'full' } },
  { presetKey: 'date', label: 'Fecha', group: 'campos', template: { type: 'date', key: 'fecha', label: 'Fecha', width: 'full' } },
  { presetKey: 'select', label: 'Desplegable', group: 'campos', template: { type: 'select', key: 'opcion', label: 'Elige una opción', width: 'full', options: DEFAULT_OPTIONS } },
  { presetKey: 'radio', label: 'Opción única', group: 'campos', template: { type: 'radio', key: 'opcion', label: 'Elige una opción', width: 'full', options: DEFAULT_OPTIONS } },
  { presetKey: 'checkbox_group', label: 'Selección múltiple', group: 'campos', template: { type: 'checkbox_group', key: 'opciones', label: 'Selecciona las que apliquen', width: 'full', options: DEFAULT_OPTIONS } },
  { presetKey: 'consent', label: 'Consentimiento', group: 'campos', template: { type: 'consent', key: 'consentimiento', label: 'Acepto recibir comunicaciones y la política de privacidad.', required: true, width: 'full' } },
  // Contenido estático
  { presetKey: 'heading', label: 'Título', group: 'contenido', template: { type: 'heading', key: 'titulo', label: 'Título', content_html: 'Título de sección', width: 'full' } },
  { presetKey: 'paragraph', label: 'Párrafo', group: 'contenido', template: { type: 'paragraph', key: 'parrafo', label: 'Párrafo', content_html: 'Escribe aquí un texto de ayuda para quien rellena el formulario.', width: 'full' } },
  // Avanzado
  { presetKey: 'hidden', label: 'Campo oculto', group: 'avanzado', template: { type: 'hidden', key: 'oculto', label: 'Campo oculto', width: 'full', default_value: '' } },
]

function slugKey(base: string): string {
  const s = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return s || 'campo'
}

function ensureUniqueKey(base: string, existing: Set<string>): string {
  let key = base
  let n = 2
  while (existing.has(key)) key = `${base}_${n++}`
  return key
}

/** Crea un campo nuevo a partir de un preset, garantizando una `key` única. */
export function fieldFromPreset(preset: FieldPreset, fields: FormField[]): FormField {
  const existing = new Set(fields.map((f) => f.key))
  const base = preset.template.key
  // Las claves reservadas de contacto se conservan si están libres; si no, se
  // degrada a una clave genérica única para no duplicar el mapeo al contacto.
  let key: string
  if (isReservedKey(base) && !existing.has(base)) {
    key = base
  } else {
    key = ensureUniqueKey(slugKey(base), existing)
  }
  return { ...preset.template, id: uid(), key }
}

// ── Migración perezosa desde BD (patrón migratePageDesign) ───────────────────

export function migrateFormSchema(raw: unknown): FormSchema {
  const doc = raw as FormSchema | null | undefined
  if (doc && !Array.isArray(doc) && doc.version === 1 && Array.isArray(doc.fields)) {
    return { version: 1, fields: doc.fields }
  }
  return defaultFormSchema()
}

export function migrateFormStyles(raw: unknown): FormStyles {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as Partial<FormStyles>
  return { ...DEFAULT_FORM_STYLES, ...doc }
}

export function migrateFormSettings(raw: unknown): FormSettings {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as Partial<FormSettings>
  return { ...DEFAULT_FORM_SETTINGS, ...doc, add_tags: Array.isArray(doc.add_tags) ? doc.add_tags : [] }
}

/** Normaliza una fila cruda de `forms` (schema/styles/settings jsonb) a un Form completo. */
export function hydrateForm(row: {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  schema: unknown
  styles: unknown
  settings: unknown
  created_at: string
  updated_at: string
}): Form {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status === 'published' ? 'published' : 'draft',
    schema: migrateFormSchema(row.schema),
    styles: migrateFormStyles(row.styles),
    settings: migrateFormSettings(row.settings),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
