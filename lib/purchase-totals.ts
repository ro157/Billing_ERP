import { calculateGST, roundToTwo } from '@/lib/utils'

export type GstType = 'CGST_SGST' | 'IGST' | 'EXEMPT'

/** Server-side purchase line totals (flat ₹ discount applied after GST) */
export function computePurchaseItemTotals(
  item: {
    quantity: number
    rate: number
    discount?: number
    gstRate: number
    taxableAmount?: number | null
    amount?: number | null
    roundOff?: number | null
  },
  gstType: GstType = 'CGST_SGST'
) {
  const gross = roundToTwo(item.quantity * item.rate)
  const taxable =
    item.taxableAmount != null ? roundToTwo(item.taxableAmount) : gross

  const gst = calculateGST(taxable, item.gstRate || 0, gstType)
  const cgst = gst.cgst
  const sgst = gst.sgst
  const igst = gst.igst
  const totalWithGstP = Math.round(roundToTwo(taxable + gst.total) * 100)
  const discP = Math.min(
    Math.max(0, Math.round(roundToTwo(Number(item.discount) || 0) * 100)),
    totalWithGstP
  )
  let total = (totalWithGstP - discP) / 100
  const totalWithGst = totalWithGstP / 100
  const discAmt = discP / 100
  const rawRoundOff = Number(item.roundOff)
  const lineRoundOff = roundToTwo(Number.isFinite(rawRoundOff) ? rawRoundOff : 0)
  total = roundToTwo(total + lineRoundOff)
  if (item.amount != null) {
    total = roundToTwo(item.amount)
  }
  return { taxable, cgst, sgst, igst, total, discAmt, totalWithGst, lineRoundOff }
}

/** Purchase order line totals — discount % applied on gross (qty × rate) before GST */
export function computePurchaseOrderItemTotals(
  item: { quantity: number; rate: number; discount?: number; gstRate: number },
  gstType: GstType = 'CGST_SGST'
) {
  const gross = roundToTwo(item.quantity * item.rate)
  const discPct = Math.min(Math.max(0, Number(item.discount) || 0), 100)
  const taxable = roundToTwo(gross * (1 - discPct / 100))
  const gst = calculateGST(taxable, item.gstRate || 0, gstType)
  const discAmt = roundToTwo(gross - taxable)
  return {
    taxable,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    total: roundToTwo(taxable + gst.total),
    discAmt,
  }
}

export { computeLineTotals as computePurchaseLineTotals } from './quotation-totals'
