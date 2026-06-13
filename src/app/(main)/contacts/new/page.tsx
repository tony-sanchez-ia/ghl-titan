import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ContactForm } from '@/features/contacts/components/ContactForm'

export default function NewContactPage() {
  return (
    <div className="space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Contactos
      </Link>
      <h1 className="text-2xl font-bold">Nuevo contacto</h1>
      <ContactForm />
    </div>
  )
}
