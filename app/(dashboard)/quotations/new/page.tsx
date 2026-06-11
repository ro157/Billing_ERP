import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const QuotationForm = dynamic(
  () => import('@/components/quotations/quotation-form').then((m) => ({ default: m.QuotationForm })),
  { loading: () => <FormPageLoader title="quotation form" /> }
)

export default function NewQuotationPage() {
  return <QuotationForm mode="create" />
}
