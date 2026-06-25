import { calculateGST, roundToTwo } from '@/lib/utils'

export type GstType = 'CGST_SGST' | 'IGST' | 'EXEMPT'

export function normalizeProductDiscountPercent(
  value: number | string | null | undefined
): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(0, n), 100)
}

/** Quotation & sales document line totals — discount % is applied on amount after GST. */
export function computeSalesDocumentLineTotals(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number,
  gstType: GstType
) {
  const gross = roundToTwo((qty || 0) * (rate || 0))
  const discPct = normalizeProductDiscountPercent(discountPercent)
  const amountBeforeGst = gross
  const gst = calculateGST(amountBeforeGst, gstRate || 0, gstType || 'CGST_SGST')
  const totalWithGst = roundToTwo(amountBeforeGst + gst.total)
  const discountAmount = roundToTwo(totalWithGst * (discPct / 100))
  const finalAmount = roundToTwo(totalWithGst - discountAmount)
  return {
    taxableGross: gross,
    discountAmount,
    amountBeforeGst,
    gst,
    totalWithGst,
    finalAmount,
  }
}

export function computeSalesDocumentItemTotals(
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
