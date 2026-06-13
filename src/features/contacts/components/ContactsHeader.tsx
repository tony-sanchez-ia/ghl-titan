'use client'

import { useState } from 'react'
import { ContactsToolbar } from './ContactsToolbar'
import { ImportDialog } from './ImportDialog'

export function ContactsHeader({ tags }: { tags: string[] }) {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <ContactsToolbar tags={tags} onImportClick={() => setImportOpen(true)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
