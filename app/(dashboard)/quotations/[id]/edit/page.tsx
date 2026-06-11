'use client'

import { useParams } from 'next/navigation'
import { QuotationForm } from '@/components/quotations/quotation-form'

export default function EditQuotationPage() {
  const params = useParams()
  const id = params.id as string
  return <QuotationForm mode="edit" quotationId={id} />
}
