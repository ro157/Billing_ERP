import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const QuotationForm = dynamic(
  () => import('@/components/quotations/quotation-form').then((m) => ({ default: m.QuotationForm })),
  { loading: () => <FormPageLoader title="quotation form" /> }
)

export default function EditQuotationPage({ params }: { params: { id: string } }) {
  return <QuotationForm mode="edit" quotationId={params.id} />
}
