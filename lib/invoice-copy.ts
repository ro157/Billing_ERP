export const INVOICE_COPY_TYPES = ['original', 'duplicate', 'triplicate'] as const

export type InvoiceCopyType = (typeof INVOICE_COPY_TYPES)[number]

export const INVOICE_COPY_LABELS: Record<InvoiceCopyType, string> = {
  original: 'ORIGINAL FOR RECIPIENT',
  duplicate: 'DUPLICATE FOR TRANSPORTER',
  triplicate: 'TRIPLICATE FOR SUPPLIER',
}

export const INVOICE_COPY_SHORT_LABELS: Record<InvoiceCopyType, string> = {
  original: 'Original (Recipient)',
  duplicate: 'Duplicate (Transporter)',
  triplicate: 'Triplicate (Supplier)',
}

export function parseInvoiceCopiesParam(param: string | null): InvoiceCopyType[] {
  if (!param || param.trim() === '' || param === 'original') return ['original']
  if (param === 'all') return [...INVOICE_COPY_TYPES]

  const requested = new Set(
    param
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
  const selected = INVOICE_COPY_TYPES.filter((copy) => requested.has(copy))
  return selected.length > 0 ? [...selected] : ['original']
}

export function invoiceCopiesToQueryParam(copies: InvoiceCopyType[]): string {
  const ordered = INVOICE_COPY_TYPES.filter((copy) => copies.includes(copy))
  if (ordered.length === 0) return 'original'
  if (ordered.length === INVOICE_COPY_TYPES.length) return 'all'
  return ordered.join(',')
}
