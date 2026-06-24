import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const DeliveryChallanForm = dynamic(
  () =>
    import('@/components/delivery-challans/delivery-challan-form').then((m) => ({
      default: m.DeliveryChallanForm,
    })),
  { loading: () => <FormPageLoader title="delivery challan form" /> }
)

export default function EditDeliveryChallanPage({ params }: { params: { id: string } }) {
  return <DeliveryChallanForm mode="edit" challanId={params.id} />
}
