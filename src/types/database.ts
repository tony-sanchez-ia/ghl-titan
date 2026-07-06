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

export interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  status: CourseStatus
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
  created_at: string
}

export interface CourseLessonProgress {
  id: string
  enrollment_id: string
  lesson_id: string
  completed_at: string
}

export interface Form {
  id: string
  slug: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
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
export interface NodeConfig {
  subject?: string // send_email
  body?: string // send_email
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

// ── Email Marketing (PRP-007) ────────────────────────────────────────────────
export type EmailBlockType = 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'footer'

export interface EmailBlock {
  id: string
  type: EmailBlockType
  config: EmailBlockConfig
}
export interface EmailBlockConfig {
  logo_url?: string // header
  title?: string // header
  text?: string // text (admite {{nombre}} {{apellido}} {{email}} y saltos de línea)
  size?: 'normal' | 'title' | 'subtitle' // text
  align?: 'left' | 'center' | 'right' // text, image, button
  image_url?: string // image
  alt?: string // image
  link_url?: string // image (opcional: la imagen enlaza)
  label?: string // button
  url?: string // button
  height?: number // spacer (px)
  footer_text?: string // footer (el link de baja se añade siempre)
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent'

export interface CampaignAudience {
  type: 'all' | 'tags'
  tags?: string[]
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  design: EmailBlock[]
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
  design: EmailBlock[]
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
  send_at: string
  status: ScheduledEmailStatus
  sent_at: string | null
  error: string | null
  click_token: string | null
  clicked_at: string | null
  created_at: string
}
