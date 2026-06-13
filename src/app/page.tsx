import { redirect } from 'next/navigation'

export default function Home() {
  // Sin splash: la raíz va directa al panel. El proxy redirige a /login si no hay sesión.
  redirect('/dashboard')
}
