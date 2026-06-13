export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
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
  created_at: string
  last_activity_at: string | null
  updated_at: string
}

export type ContactActivityType =
  | 'imported'
  | 'booking_created'
  | 'email_sent'
  | 'form_submitted'
  | 'enrolled'
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

export interface AutomationStep {
  id: string
  automation_id: string
  position: number
  delay_value: number
  delay_unit: DelayUnit
  subject: string
  body: string
  created_at: string
}

export type ScheduledEmailStatus = 'pending' | 'sent' | 'failed'

export interface ScheduledEmail {
  id: string
  automation_id: string
  step_id: string
  contact_id: string
  to_email: string
  subject: string
  body: string
  send_at: string
  status: ScheduledEmailStatus
  sent_at: string | null
  error: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      contacts: {
        Row: Contact
        Insert: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Contact, 'id' | 'created_at'>>
      }
      contact_activities: {
        Row: ContactActivity
        Insert: Omit<ContactActivity, 'id' | 'created_at'>
        Update: Partial<Omit<ContactActivity, 'id' | 'created_at'>>
      }
      calendars: {
        Row: Calendar
        Insert: Partial<Omit<Calendar, 'id' | 'created_at' | 'updated_at'>> &
          Pick<Calendar, 'slug' | 'name'>
        Update: Partial<Omit<Calendar, 'id' | 'created_at'>>
      }
      calendar_availability: {
        Row: CalendarAvailability
        Insert: Omit<CalendarAvailability, 'id' | 'created_at'>
        Update: Partial<Omit<CalendarAvailability, 'id' | 'created_at'>>
      }
      bookings: {
        Row: Booking
        Insert: Partial<Omit<Booking, 'id' | 'created_at'>> &
          Pick<Booking, 'calendar_id' | 'name' | 'email' | 'starts_at' | 'ends_at'>
        Update: Partial<Omit<Booking, 'id' | 'created_at'>>
      }
      courses: {
        Row: Course
        Insert: Partial<Omit<Course, 'id' | 'created_at' | 'updated_at'>> &
          Pick<Course, 'slug' | 'title'>
        Update: Partial<Omit<Course, 'id' | 'created_at'>>
      }
      course_modules: {
        Row: CourseModule
        Insert: Partial<Omit<CourseModule, 'id' | 'created_at'>> &
          Pick<CourseModule, 'course_id' | 'title'>
        Update: Partial<Omit<CourseModule, 'id' | 'created_at'>>
      }
      course_lessons: {
        Row: CourseLesson
        Insert: Partial<Omit<CourseLesson, 'id' | 'created_at'>> &
          Pick<CourseLesson, 'module_id' | 'title' | 'type'>
        Update: Partial<Omit<CourseLesson, 'id' | 'created_at'>>
      }
      course_enrollments: {
        Row: CourseEnrollment
        Insert: Partial<Omit<CourseEnrollment, 'id' | 'created_at'>> &
          Pick<CourseEnrollment, 'course_id' | 'name' | 'email'>
        Update: Partial<Omit<CourseEnrollment, 'id' | 'created_at'>>
      }
      course_lesson_progress: {
        Row: CourseLessonProgress
        Insert: Pick<CourseLessonProgress, 'enrollment_id' | 'lesson_id'>
        Update: never
      }
      forms: {
        Row: Form
        Insert: Partial<Omit<Form, 'id' | 'created_at' | 'updated_at'>> &
          Pick<Form, 'slug' | 'name'>
        Update: Partial<Omit<Form, 'id' | 'created_at'>>
      }
      automations: {
        Row: Automation
        Insert: Partial<Omit<Automation, 'id' | 'created_at' | 'updated_at'>> &
          Pick<Automation, 'name'>
        Update: Partial<Omit<Automation, 'id' | 'created_at'>>
      }
      automation_steps: {
        Row: AutomationStep
        Insert: Partial<Omit<AutomationStep, 'id' | 'created_at'>> &
          Pick<AutomationStep, 'automation_id' | 'subject' | 'body'>
        Update: Partial<Omit<AutomationStep, 'id' | 'created_at'>>
      }
      automation_triggers: {
        Row: { automation_id: string; form_id: string }
        Insert: { automation_id: string; form_id: string }
        Update: never
      }
      scheduled_emails: {
        Row: ScheduledEmail
        Insert: Partial<Omit<ScheduledEmail, 'id' | 'created_at'>> &
          Pick<ScheduledEmail, 'automation_id' | 'step_id' | 'contact_id' | 'to_email' | 'subject' | 'body' | 'send_at'>
        Update: Partial<Omit<ScheduledEmail, 'id' | 'created_at'>>
      }
    }
  }
}
