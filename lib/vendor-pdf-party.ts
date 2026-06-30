import type { QuotationPdfCustomer } from '@/lib/quotation-pdf'

export function vendorToPdfParty(v: {
  name?: string | null
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
}): QuotationPdfCustomer {
  return {
    name: v.name || '-',
    contact_person: v.contact_person,
    phone: v.phone,
    mobile: v.mobile,
    gstin: v.gstin,
    pan: v.pan,
    billing_address: v.address,
    billing_city: v.city,
    billing_state: v.state,
    shipping_address: v.address,
    shipping_city: v.city,
    shipping_state: v.state,
  }
}
