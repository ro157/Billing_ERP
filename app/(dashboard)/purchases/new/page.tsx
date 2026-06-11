import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const PurchaseForm = dynamic(
  () => import('@/components/purchases/purchase-form').then((m) => ({ default: m.PurchaseForm })),
  { loading: () => <FormPageLoader title="purchase form" /> }
)

export default function NewPurchasePage() {
  return <PurchaseForm />
}
