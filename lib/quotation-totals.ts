import { computeSalesDocumentLineTotals, type GstType } from '@/lib/sales-document-totals'
export type { GstType } from '@/lib/sales-document-totals'
export function computeLineTotals(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number,
  gstType: GstType
) {
  return computeSalesDocumentLineTotals(qty, rate, discountPercent, gstRate, gstType)
}

/** Server-side line totals for quotation API */
export function computeQuotationItemTotals(
  item: { quantity: number; rate: number; discount?: number; gstRate: number },
  gstType: GstType = 'CGST_SGST'
) {
  const line = computeSalesDocumentLineTotals(
    item.quantity,
    item.rate,
    item.discount || 0,
    item.gstRate,
    gstType
  )
  return {
    taxable: line.amountBeforeGst,
    cgst: line.gst.cgst,
    sgst: line.gst.sgst,
    igst: line.gst.igst,
    total: line.finalAmount,
    discAmt: line.discountAmount,
    totalWithGst: line.totalWithGst,
  }
}
