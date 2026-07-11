import { NextResponse, type NextRequest } from 'next/server'
import { queryOne } from '@/lib/db'

/**
 * Enlace de acceso personal de un alumno: valida el token, deja la cookie de
 * acceso del curso (la misma que la inscripción pública) y redirige al curso.
 * Token inválido → redirige al curso (mostrará la puerta de entrada).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params
  const target = new URL(`/learn/${slug}`, request.url)

  const row = await queryOne<{ course_id: string; email: string }>(
    `select e.course_id, e.email
     from course_enrollments e
     join courses c on c.id = e.course_id
     where c.slug = $1 and e.access_token = $2`,
    [slug, token]
  )
  const res = NextResponse.redirect(target)
  if (row) {
    res.cookies.set(`course_email_${row.course_id}`, row.email, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return res
}
