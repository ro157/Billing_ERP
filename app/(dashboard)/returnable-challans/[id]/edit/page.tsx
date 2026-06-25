import dynamic from 'next/dynamic'
import { FormPageLoader } from '@/components/layout/page-loader'

const ReturnableChallanForm = dynamic(
  () =>
    import('@/components/returnable-challans/returnable-challan-form').then((m) => ({
      default: m.ReturnableChallanForm,
    })),
  { loading: () => <FormPageLoader title="returnable challan form" /> }
)

export default function EditReturnableChallanPage({ params }: { params: { id: string } }) {
  return <ReturnableChallanForm mode="edit" challanId={params.id} />
}
