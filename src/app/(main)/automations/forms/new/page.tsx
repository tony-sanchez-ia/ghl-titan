import { redirect } from 'next/navigation'

// Los formularios se gestionan ahora en Web → Formularios (PRP-011).
export default function NewFormRedirect() {
  redirect('/forms')
}
