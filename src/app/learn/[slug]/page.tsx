import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getPublicCourse, getEnrollment } from '@/features/courses/services/courses'
import { EnrollGate } from '@/features/courses/components/learn/EnrollGate'
import { LearnExperience } from '@/features/courses/components/learn/LearnExperience'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const course = await getPublicCourse(slug)
  return { title: course ? course.title : 'Curso' }
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await getPublicCourse(slug)
  if (!course) notFound()

  const jar = await cookies()
  const email = jar.get(`course_email_${course.id}`)?.value

  const enrollment = email ? await getEnrollment(course.id, email) : null

  if (!enrollment) {
    return (
      <EnrollGate
        slug={course.slug}
        title={course.title}
        description={course.description}
        coverUrl={course.cover_image_url}
      />
    )
  }

  return (
    <LearnExperience
      course={course}
      completedLessonIds={enrollment.completedLessonIds}
      studentName={enrollment.enrollment.name}
    />
  )
}
