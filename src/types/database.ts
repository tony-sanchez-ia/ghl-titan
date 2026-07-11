export interface User {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  ghl_contact_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  business_name: string | null
  tags: string[]
  source: string
  unsubscribed_at: string | null
  unsubscribe_token: string
  created_at: string
  last_activity_at: string | null
  updated_at: string
}

export type ContactActivityType =
  | 'imported'
  | 'booking_created'
  | 'email_sent'
  | 'email_clicked'
  | 'form_submitted'
  | 'enrolled'
  | 'tag_added'
  | 'note'

export interface ContactActivity {
  id: string
  contact_id: string
  type: ContactActivityType
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type LocationType = 'google_meet' | 'custom_link' | 'in_person'

export interface Calendar {
  id: string
  slug: string
  name: string
  description: string | null
  duration_min: number
  min_notice_hours: number
  window_days: number
  buffer_before_min: number
  buffer_after_min: number
  location_type: LocationType
  location_value: string | null
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CalendarAvailability {
  id: string
  calendar_id: string
  weekday: number // 0=domingo ... 6=sábado
  start_time: string // 'HH:MM:SS'
  end_time: string
  created_at: string
}

export type BookingStatus = 'confirmed' | 'cancelled'

export interface Booking {
  id: string
  calendar_id: string
  contact_id: string | null
  name: string
  email: string
  phone: string | null
  starts_at: string
  ends_at: string
  status: BookingStatus
  location_type: LocationType | null
  location_value: string | null
  notes: string | null
  created_at: string
}

export type CourseStatus = 'draft' | 'published'
export type LessonType = 'video' | 'text' | 'quiz'

export interface QuizOption {
  id: string
  text: string
}
export interface QuizQuestion {
  id: string
  text: string
  options: QuizOption[]
  correct_option_id: string
}
export interface Quiz {
  questions: QuizQuestion[]
  passing: boolean
}

export type CourseAccessMode = 'open' | 'invite'

export interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  status: CourseStatus
  access_mode: CourseAccessMode
  created_at: string
  updated_at: string
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  position: number
  created_at: string
}

export interface CourseLesson {
  id: string
  module_id: string
  title: string
  type: LessonType
  position: number
  is_published: boolean
  video_url: string | null
  content: string | null
  quiz: Quiz | null
  created_at: string
}

export interface CourseEnrollment {
  id: string
  course_id: string
  contact_id: string | null
  name: string
  email: string
  access_token: string | null
  created_at: string
}

export interface CourseLessonProgress {
  id: string
  enrollment_id: string
  lesson_id: string
  completed_at: string
}

// ── Formularios (Form Builder — PRP-011) ─────────────────────────────────────
export type FormStatus = 'draft' | 'published'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox_group'
  | 'consent'
  | 'heading'
  | 'paragraph'
  | 'hidden'

export interface FieldOption {
  label: string
  value: string
}

export interface FormField {
  id: string
  type: FieldType
  key: string // clave del dato; las reservadas mapean a columnas de contacts
  label: string
  placeholder?: string
  help?: string
  required?: boolean
  width: 'full' | 'half' // 'half' = media columna (2 por fila en escritorio)
  options?: FieldOption[] // select | radio | checkbox_group
  content_html?: string // heading | paragraph (texto estático saneado)
  default_value?: string // hidden | text
}

/**
 * Claves reservadas que mapean directamente a columnas de `contacts`.
 * `full_name` es especial: se parte en first_name + last_name al enviar.
 */
export const CONTACT_FIELD_KEYS = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'business_name',
] as const
export type ContactFieldKey = (typeof CONTACT_FIELD_KEYS)[number]

export interface FormSchema {
  version: 1
  fields: FormField[]
}

export type LabelAlign = 'top' | 'left'
export type FormTheme = 'clean' | 'card' | 'minimal'

export interface FormStyles {
  theme: FormTheme
  background_color: string
  text_color: string
  button_color: string
  button_text_color: string
  border_color: string
  border_width: number
  border_radius: number // radio del contenedor
  field_radius: number // radio de los campos
  width: number // ancho máximo (px)
  label_align: LabelAlign
}

export type SubmitAction = 'message' | 'redirect'

export interface FormSettings {
  submit_label: string
  submit_action: SubmitAction
  message_html?: string // 'message' (saneado)
  redirect_url?: string // 'redirect' (URL absoluta http/https)
  add_tags: string[] // etiquetas a aplicar al contacto
}

export interface Form {
  id: string
  slug: string
  name: string
  description: string | null
  status: FormStatus
  schema: FormSchema
  styles: FormStyles
  settings: FormSettings
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  contact_id: string | null
  data: Record<string, unknown>
  visitor_id: string | null
  created_at: string
}

export type FormEventType = 'view'

export interface FormEvent {
  id: string
  form_id: string
  visitor_id: string
  type: FormEventType
  metadata: Record<string, unknown>
  created_at: string
}

export type AutomationStatus = 'draft' | 'active'
export type DelayUnit = 'days' | 'hours'

export interface Automation {
  id: string
  name: string
  status: AutomationStatus
  created_at: string
  updated_at: string
}

// ── Workflow visual (PRP-006) ────────────────────────────────────────────────
export type TriggerType = 'form_submitted' | 'booking_created' | 'tag_added'

export interface AutomationTriggerDef {
  id: string
  automation_id: string
  type: TriggerType
  config: TriggerConfig
  created_at: string
}
export interface TriggerConfig {
  form_id?: string
  calendar_id?: string | null // null/ausente = todos los calendarios
  tag?: string
}

export type NodeType = 'send_email' | 'wait' | 'add_tag' | 'add_note' | 'branch_email_click'
export type NodeBranch = 'yes' | 'no'

export interface AutomationNode {
  id: string
  automation_id: string
  parent_node_id: string | null // null = cadena raíz
  branch: NodeBranch | null // solo hijos de branch_email_click
  position: number
  type: NodeType
  config: NodeConfig
  created_at: string
}
export type AutomationEmailMode = 'simple' | 'designed'

export interface NodeConfig {
  subject?: string // send_email
  body?: string // send_email (modo simple)
  email_mode?: AutomationEmailMode // send_email ('simple' por defecto)
  design?: StoredEmailDesign // send_email (modo designed, formato V2 de marketing)
  delay_value?: number // wait
  delay_unit?: DelayUnit // wait
  tag?: string // add_tag
  note?: string // add_note
  wait_value?: number // branch_email_click (ventana de espera del click)
  wait_unit?: DelayUnit // branch_email_click
}

export type EnrollmentStatus = 'active' | 'waiting_click' | 'completed' | 'cancelled'

export interface AutomationEnrollment {
  id: string
  automation_id: string
  contact_id: string
  status: EnrollmentStatus
  current_node_id: string | null
  next_run_at: string | null
  wait_until: string | null
  waiting_email_id: string | null
  context: { email?: string; trigger_type?: TriggerType }
  created_at: string
  updated_at: string
}

// ── Email Marketing (PRP-007 + bloques V2 de PRP-008) ───────────────────────
export type EmailBlockType =
  | 'header'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'footer'
  | 'social'
  | 'video'
  | 'form'
  | 'html'

export type SocialNetwork =
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'youtube'
  | 'linkedin'
  | 'tiktok'
  | 'whatsapp'

export interface EmailBlock {
  id: string
  type: EmailBlockType
  config: EmailBlockConfig
}
export interface EmailBlockConfig {
  logo_url?: string // header
  title?: string // header
  text?: string // text plano legado (V1: saltos de línea, sin formato)
  html?: string // text con formato inline (b/i/a saneado) · bloque html (saneado básico)
  size?: 'normal' | 'title' | 'subtitle' // text
  align?: 'left' | 'center' | 'right' // text, image, button, social, video, form
  image_url?: string // image
  alt?: string // image
  link_url?: string // image (opcional: la imagen enlaza)
  label?: string // button, form (texto del botón)
  url?: string // button · form (URL pública del formulario, calculada al elegirlo)
  height?: number // spacer (px)
  footer_text?: string // footer (el link de baja se añade siempre)
  networks?: { network: SocialNetwork; url: string }[] // social
  video_url?: string // video
  thumbnail_url?: string // video (auto para YouTube, manual para el resto)
  form_id?: string // form (formulario de captura elegido)
}

// ── Diseño V2: secciones con columnas (PRP-008) ──────────────────────────────
export type SectionLayout = '1' | '2' | '3' | '4' | '1/3:2/3' | '2/3:1/3' | '1/4:3/4' | '3/4:1/4'

export interface EmailSectionConfig {
  background_color?: string // '#rrggbb'; ausente = transparente (fondo del email)
  padding?: number // padding vertical en px
}

export interface EmailSection {
  id: string
  layout: SectionLayout
  config: EmailSectionConfig
  columns: EmailBlock[][] // un array de bloques por columna (longitud = nº columnas del layout)
}

export interface EmailDesignStyles {
  background_color: string // fondo del email
  button_color: string // botones y bloque formulario
}

export interface EmailDesign {
  version: 2
  styles: EmailDesignStyles
  sections: EmailSection[]
}

/** Lo que puede venir de BD: documento V2 o el array plano legado (V1). */
export type StoredEmailDesign = EmailDesign | EmailBlock[]

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent'

export interface CampaignAudience {
  type: 'all' | 'tags'
  tags?: string[]
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  design: StoredEmailDesign
  html_snapshot: string | null
  link_urls: string[]
  status: CampaignStatus
  audience: CampaignAudience
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type CampaignRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  to_email: string
  status: CampaignRecipientStatus
  sent_at: string | null
  error: string | null
  click_token: string
  clicked_at: string | null
  created_at: string
}

export interface EmailTemplate {
  id: string
  name: string
  design: StoredEmailDesign
  created_at: string
  updated_at: string
}

export type ScheduledEmailStatus = 'pending' | 'sent' | 'failed'

export interface ScheduledEmail {
  id: string
  automation_id: string
  step_id: string | null // legado (modelo lineal pre-PRP-006)
  node_id: string | null
  enrollment_id: string | null
  contact_id: string
  to_email: string
  subject: string
  body: string
  design: StoredEmailDesign | null // diseño V2 (null = modo simple/texto)
  send_at: string
  status: ScheduledEmailStatus
  sent_at: string | null
  error: string | null
  click_token: string | null
  clicked_at: string | null
  created_at: string
}

// ── Funnels: landing pages y embudos de venta (PRP-009) ─────────────────────

export type FunnelStatus = 'draft' | 'published'

export interface Funnel {
  id: string
  name: string
  slug: string
  status: FunnelStatus
  brief: string | null
  created_at: string
  updated_at: string
}

export interface FunnelStep {
  id: string
  funnel_id: string
  slug: string
  name: string
  position: number
  seo_title: string | null
  seo_description: string | null
  ab_active: boolean
  created_at: string
  updated_at: string
}

// Diseño de PÁGINA web (no email): mismo lenguaje secciones/columnas/bloques
// que EmailDesign pero con render web propio (Tailwind, full-width).
export type PageBlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'video'
  | 'form'
  | 'html'
  | 'divider'
  | 'spacer'

export interface PageBlock {
  id: string
  type: PageBlockType
  config: PageBlockConfig
}

export interface PageBlockConfig {
  text?: string // heading (texto plano)
  html?: string // text con formato inline (saneado) · bloque html (saneado)
  level?: 1 | 2 | 3 // heading (jerarquía visual)
  align?: 'left' | 'center' | 'right' // heading, text, image, button, video, form
  image_url?: string // image
  alt?: string // image
  link_url?: string // image (opcional: la imagen enlaza)
  label?: string // button, form (texto del botón)
  url?: string // button (destino del CTA)
  video_url?: string // video (YouTube/Vimeo)
  form_id?: string // form (formulario de captura embebido)
  form_slug?: string // form (slug para el enlace público, relativo al dominio)
  height?: number // spacer (px)
}

export interface PageSectionConfig {
  background_color?: string // '#rrggbb'; ausente = fondo de la página
  padding?: number // padding vertical en px
}

export interface PageSection {
  id: string
  layout: SectionLayout
  config: PageSectionConfig
  columns: PageBlock[][] // un array de bloques por columna (longitud = nº columnas del layout)
}

export interface PageDesignStyles {
  background_color: string // fondo de la página
  button_color: string // botones y CTA
  text_color: string // color base del texto
}

export interface PageDesign {
  version: 1
  styles: PageDesignStyles
  sections: PageSection[]
}

export type VariantKey = 'A' | 'B'

export interface FunnelStepVariant {
  id: string
  step_id: string
  variant_key: VariantKey
  design: PageDesign
  created_at: string
  updated_at: string
}

export interface FunnelDomain {
  id: string
  hostname: string
  funnel_id: string
  created_at: string
}

export type FunnelEventType = 'page_view' | 'cta_click' | 'form_submit'

export interface FunnelEvent {
  id: string
  funnel_id: string
  step_id: string
  variant_id: string | null
  visitor_id: string
  type: FunnelEventType
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Sitios web (PRP-014) ────────────────────────────────────────────────────

export type WebsiteStatus = 'draft' | 'published'

export interface Website {
  id: string
  name: string
  slug: string
  brief: string | null
  favicon_url: string | null
  head_scripts: string | null
  body_scripts: string | null
  status: WebsiteStatus
  created_at: string
  updated_at: string
}

export interface WebsitePage {
  id: string
  website_id: string
  slug: string
  name: string
  is_home: boolean
  seo_title: string | null
  seo_description: string | null
  design: PageDesign
  position: number
  created_at: string
  updated_at: string
}

export interface WebsiteDomain {
  id: string
  hostname: string
  website_id: string
  created_at: string
}

// ─── Integraciones (PRP-010) ─────────────────────────────────────────────────

export type IntegrationStatus = 'connected' | 'reauth_required'

export interface IntegrationConnection {
  id: string
  provider: string
  account_email: string | null
  refresh_token_enc: string
  access_token: string | null
  access_token_expires_at: string | null
  calendar_id: string | null
  calendar_name: string | null
  status: IntegrationStatus
  connected_at: string
  updated_at: string
}
