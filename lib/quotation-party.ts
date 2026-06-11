export interface QuotationPartySnapshot {
  name?: string
  contactPerson?: string
  address?: string
  mobile?: string
  gstin?: string
  pan?: string
  city?: string
  state?: string
}

export interface QuotationPartyDetails {
  buyer?: QuotationPartySnapshot
  consignee?: QuotationPartySnapshot
}

function pickText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function parseQuotationPartyDetails(raw: unknown): QuotationPartyDetails | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as QuotationPartyDetails
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as QuotationPartyDetails
  return null
}

export function buildPdfParties(
  customer: {
    name?: string | null
    contact_person?: string | null
    phone?: string | null
    mobile?: string | null
    gstin?: string | null
    pan?: string | null
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    shipping_address?: string | null
    shipping_city?: string | null
    shipping_state?: string | null
  },
  partyDetails: QuotationPartyDetails | null
) {
  const buyer = partyDetails?.buyer
  const consignee = partyDetails?.consignee

  return {
    buyer: {
      name: pickText(buyer?.name, customer.name) || '',
      contact_person: pickText(buyer?.contactPerson, customer.contact_person),
      phone: customer.phone ?? null,
      mobile: pickText(buyer?.mobile, customer.mobile, customer.phone),
      gstin: pickText(buyer?.gstin, customer.gstin),
      pan: pickText(buyer?.pan, customer.pan),
      billing_address: pickText(buyer?.address, customer.billing_address),
      billing_city: pickText(buyer?.city, customer.billing_city),
      billing_state: pickText(buyer?.state, customer.billing_state),
      shipping_address: pickText(buyer?.address, customer.shipping_address, customer.billing_address),
      shipping_city: pickText(buyer?.city, customer.shipping_city, customer.billing_city),
      shipping_state: pickText(buyer?.state, customer.shipping_state, customer.billing_state),
    },
    consignee: {
      name: pickText(consignee?.name, buyer?.name, customer.name) || '',
      contact_person: pickText(consignee?.contactPerson, buyer?.contactPerson, customer.contact_person),
      phone: customer.phone ?? null,
      mobile: pickText(consignee?.mobile, buyer?.mobile, customer.mobile, customer.phone),
      gstin: pickText(consignee?.gstin, buyer?.gstin, customer.gstin),
      pan: pickText(consignee?.pan, buyer?.pan, customer.pan),
      billing_address: pickText(consignee?.address, customer.shipping_address, customer.billing_address),
      billing_city: pickText(consignee?.city, customer.shipping_city, customer.billing_city),
      billing_state: pickText(consignee?.state, customer.shipping_state, customer.billing_state),
      shipping_address: pickText(consignee?.address, customer.shipping_address, customer.billing_address),
      shipping_city: pickText(consignee?.city, customer.shipping_city, customer.billing_city),
      shipping_state: pickText(consignee?.state, customer.shipping_state, customer.billing_state),
    },
  }
}
