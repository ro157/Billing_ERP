export type PartyFields = {
  name: string
  contactPerson: string
  address: string
  mobile: string
  gstin: string
  pan: string
  city: string
}

export type PartyCustomer = {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  billing_address?: string | null
  billing_city?: string | null
  shipping_address?: string | null
  shipping_city?: string | null
}

export const emptyParty: PartyFields = {
  name: '',
  contactPerson: '',
  address: '',
  mobile: '',
  gstin: '',
  pan: '',
  city: '',
}

export function partiesMatch(a: PartyFields, b: PartyFields): boolean {
  return (
    a.name === b.name &&
    a.contactPerson === b.contactPerson &&
    a.address === b.address &&
    a.mobile === b.mobile &&
    a.gstin === b.gstin &&
    a.pan === b.pan &&
    a.city === b.city
  )
}

export function customerToBuyer(c: PartyCustomer): PartyFields {
  return {
    name: c.name,
    contactPerson: c.contact_person || '',
    address: c.billing_address || '',
    mobile: c.mobile || c.phone || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    city: c.billing_city || '',
  }
}

export function customerToConsignee(c: PartyCustomer): PartyFields {
  return {
    name: c.name,
    contactPerson: c.contact_person || '',
    address: c.shipping_address || c.billing_address || '',
    mobile: c.mobile || c.phone || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    city: c.shipping_city || c.billing_city || '',
  }
}
