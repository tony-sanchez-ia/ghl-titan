import { redirect } from 'next/navigation'

// El id es el mismo forms.id → redirige al nuevo editor (Web → Formularios, PRP-011).
export default async function EditFormRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/forms/${id}`)
}
