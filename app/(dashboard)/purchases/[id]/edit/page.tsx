import { PurchaseForm } from '@/components/purchases/purchase-form'

export default function EditPurchasePage({ params }: { params: { id: string } }) {
  return <PurchaseForm purchaseId={params.id} />
}
