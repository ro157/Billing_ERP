import { calculateGST, roundToTwo } from '@/lib/utils'

export type GstType = 'CGST_SGST' | 'IGST' | 'EXEMPT'

function toPaise(amount: number): number {
  return Math.round(roundToTwo(amount) * 100)
}

function fromPaise(paise: number): number {
  return paise / 100
}

/** Server-side line totals for quotation API */
export function computeQuotationItemTotals(
  item: { quantity: number; rate: number; discount?: number; gstRate: number },
  gstType: GstType = 'CGST_SGST'
) {
  const taxable = roundToTwo(item.quantity * item.rate)
  const gst = calculateGST(taxable, item.gstRate || 0, gstType)
  const totalWithGstP = toPaise(taxable + gst.total)
  const discP = Math.min(Math.max(0, toPaise(Number(item.discount) || 0)), totalWithGstP)
  const total = fromPaise(totalWithGstP - discP)
  const totalWithGst = fromPaise(totalWithGstP)
  const discAmt = fromPaise(discP)
  return { taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, total, discAmt, totalWithGst }
}

/** Client-side line totals (discount applied after GST on line total) */
export function computeLineTotals(
  qty: number,
  rate: number,
  discountFlat: number,
  gstRate: number,
  gstType: GstType
) {
  const taxableGross = roundToTwo((qty || 0) * (rate || 0))
  const amountBeforeGst = taxableGross
  const gst = calculateGST(amountBeforeGst, gstRate || 0, gstType || 'CGST_SGST')
  const totalWithGstP = toPaise(amountBeforeGst + gst.total)
  const discountP = Math.min(Math.max(0, toPaise(Number(discountFlat) || 0)), totalWithGstP)
  const totalWithGst = fromPaise(totalWithGstP)
  const discountAmount = fromPaise(discountP)
  const finalAmount = fromPaise(totalWithGstP - discountP)
  return { taxableGross, discountAmount, amountBeforeGst, gst, totalWithGst, finalAmount }
}
