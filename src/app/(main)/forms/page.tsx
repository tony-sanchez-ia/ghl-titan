import { listForms } from '@/features/forms/services/queries'
import { FormList } from '@/features/forms/components/FormList'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
  const forms = await listForms()
  return <FormList forms={forms} />
}
