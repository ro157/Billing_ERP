import { calculateGST, computeRoundOff, roundToNearestRupee, roundToTwo } from '@/lib/utils'
import { randomUUID } from 'crypto'

export function computeQuotationItemTotals(item: {
  quantity: number
  rate: number
  discount?: number
  gstRate: number
}, gstType = 'CGST_SGST') {
  const taxable = roundToTwo(item.quantity * item.rate)
  const gst = calculateGST(taxable, item.gstRate || 0, gstType)
  const totalWithGst = roundToTwo(taxable + gst.total)
  const discAmt = roundToTwo(Math.min(Math.max(0, Number(item.discount) || 0), totalWithGst))
  const total = roundToTwo(totalWithGst - discAmt)
  return { taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, total, discAmt }
}

export function buildQuotationTotals(items: any[], gstType: string) {
  let subtotal = 0
  let totalDiscount = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0
  let grandTotal = 0

  const itemsWithTotals = items.map((item: any) => {
    const t = computeQuotationItemTotals(item, gstType)
    subtotal += item.quantity * item.rate
    totalDiscount += t.discAmt
    totalCgst += t.cgst
    totalSgst += t.sgst
    totalIgst += t.igst
    grandTotal += t.total
    return { ...item, ...t }
  })

  const roundOff = computeRoundOff(grandTotal)
  grandTotal = roundToNearestRupee(grandTotal)

  return {
    itemsWithTotals,
    subtotal,
    totalDiscount,
    totalCgst,
    totalSgst,
    totalIgst,
    taxAmount: totalCgst + totalSgst + totalIgst,
    roundOff,
    grandTotal,
  }
}

export async function insertQuotationItems(
  conn: Awaited<ReturnType<typeof import('@/lib/db').default.getConnection>>,
  quotationId: string,
  itemsWithTotals: any[]
) {
  for (const item of itemsWithTotals) {
    await conn.execute(
      `INSERT INTO quotation_items (id, quotation_id, product_id, description, quantity, rate,
        discount, gst_rate, gst_amount, amount)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        randomUUID(),
        quotationId,
        item.productId || null,
        item.description || null,
        item.quantity,
        item.rate,
        item.discount || 0,
        item.gstRate,
        item.cgst + item.sgst + item.igst,
        item.total,
      ]
    )
  }
}
