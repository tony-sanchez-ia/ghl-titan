import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getPublicCourse, getEnrollment, publishedLessonIds } from '@/features/courses/services/courses'
import { Certificate } from '@/features/courses/components/learn/Certificate'

export const dynamic = 'force-dynamic'

export default async function CertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await getPublicCourse(slug)
  if (!course) notFound()

  const jar = await cookies()
  const email = jar.get(`course_email_${course.id}`)?.value
  const enrollment = email ? await getEnrollment(course.id, email) : null
  if (!enrollment) redirect(`/learn/${slug}`)

  const lessonIds = publishedLessonIds(course)
  const completed = new Set(enrollment.completedLessonIds)
  const allDone = lessonIds.length > 0 && lessonIds.every((id) => completed.has(id))
  if (!allDone) redirect(`/learn/${slug}`)

  const dateLabel = formatInTimeZone(new Date(), 'Europe/Madrid', "d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <Certificate
      studentName={enrollment.enrollment.name}
      courseTitle={course.title}
      dateLabel={dateLabel}
    />
  )
}
