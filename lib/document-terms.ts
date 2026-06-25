/** Default terms printed on documents when module-specific settings are empty. */
export function resolveDocumentTerms(
  documentTerms: string | null | undefined,
  moduleTerms: string | null | undefined,
  legacyTerms?: string | null | undefined
): string | null {
  const value = documentTerms?.trim() || moduleTerms?.trim() || legacyTerms?.trim()
  return value || null
}

export const DOCUMENT_TERMS_MODULES = [
  { field: 'quotationTerms', label: 'Quotations', placeholder: 'Terms to print on quotations...' },
  { field: 'salesInvoiceTerms', label: 'Sales Invoice', placeholder: 'Terms to print on sales invoices...' },
  { field: 'purchaseOrderTerms', label: 'Purchase Order', placeholder: 'Terms to print on purchase orders...' },
  { field: 'purchaseInvoiceTerms', label: 'Purchase Invoice', placeholder: 'Terms to print on purchase invoices...' },
  { field: 'deliveryChallanTerms', label: 'Delivery Challan', placeholder: 'Terms to print on delivery challans...' },
  { field: 'returnableChallanTerms', label: 'Returnable Challans', placeholder: 'Terms to print on returnable challans...' },
] as const

export type DefaultDocumentTermsModule =
  | 'quotation'
  | 'sales-invoice'
  | 'purchase-order'
  | 'purchase-invoice'
  | 'delivery-challan'
  | 'returnable-challan'

export function resolveSettingsDocumentTerms(
  moduleTerms: string | null | undefined,
  legacyTerms?: string | null | undefined
): string {
  return (moduleTerms?.trim() || legacyTerms?.trim() || '')
}

export async function fetchDefaultDocumentTerms(module: DefaultDocumentTermsModule): Promise<string> {
  const res = await fetch(`/api/settings/document-terms?module=${module}`)
  if (!res.ok) return ''
  const data = await res.json()
  return typeof data.terms === 'string' ? data.terms : ''
}
