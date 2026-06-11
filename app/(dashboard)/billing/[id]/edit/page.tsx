import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const InvoiceForm = dynamic(
  () => import('@/components/billing/invoice-form').then((m) => ({ default: m.InvoiceForm })),
  { loading: () => <FormPageLoader title="invoice form" /> }
)

export default function EditInvoicePage({ params }: { params: { id: string } }) {
  return <InvoiceForm invoiceId={params.id} />
}
