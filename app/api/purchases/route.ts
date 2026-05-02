import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { purchaseSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

function computeItemTotals(item: any, gstType = 'CGST_SGST') {
  const taxable = item.quantity * item.rate * (1 - (item.discount || 0) / 100)
  let cgst = 0, sgst = 0, igst = 0
  if (gstType === 'CGST_SGST') { cgst = taxable * item.gstRate / 200; sgst = cgst }
  else if (gstType === 'IGST') { igst = taxable * item.gstRate / 100 }
  const total = taxable + cgst + sgst + igst
  const discAmt = item.quantity * item.rate - taxable
  return { taxable, cgst, sgst, igst, total, discAmt }
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('purchases', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const vendorId = searchParams.get('vendorId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) { conditions.push('(p.purchase_no LIKE ? OR v.name LIKE ?)'); const s = `%${search}%`; params.push(s, s) }
  if (status) { conditions.push('p.status = ?'); params.push(status) }
  if (vendorId) { conditions.push('p.vendor_id = ?'); params.push(vendorId) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await db.execute(
    `SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
     ${where} ORDER BY p.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id ${where}`, params
  ) as any[]

  return NextResponse.json({ purchases: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('purchases', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = purchaseSchema.parse(body)
    const gstType = data.gstType
    await conn.beginTransaction()

    const [settings] = await conn.execute('SELECT po_prefix FROM business_settings LIMIT 1') as any[]
    const prefix = settings[0]?.po_prefix || 'PUR'
    const [last] = await conn.execute(
      'SELECT purchase_no FROM purchases ORDER BY created_at DESC LIMIT 1'
    ) as any[]
    let nextNum = 1
    if (last[0]) { const m = last[0].purchase_no.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1 }
    const purchaseNo = `${prefix}${String(nextNum).padStart(4, '0')}`

    let subtotal = 0, totalDiscount = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal = 0
    const itemsWithTotals = data.items.map((item: any) => {
      const t = computeItemTotals(item, gstType)
      subtotal += item.quantity * item.rate; totalDiscount += t.discAmt; totalTaxable += t.taxable
      totalCgst += t.cgst; totalSgst += t.sgst; totalIgst += t.igst; grandTotal += t.total
      return { ...item, ...t }
    })

    const id = randomUUID()
    await conn.execute(
      `INSERT INTO purchases (id, purchase_no, vendor_id, date, due_date, gst_type, bill_no, bill_date,
        subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, tax_amount, total_amount,
        paid_amount, balance_amount, payment_mode, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, purchaseNo, data.vendorId, data.date, data.dueDate || null,
       gstType, data.billNo || null, data.billDate || null,
       subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalCgst + totalSgst + totalIgst, grandTotal,
       data.paidAmount, grandTotal - data.paidAmount,
       data.paymentMode || null, data.notes || null,
       grandTotal - data.paidAmount <= 0 ? 'PAID' : data.paidAmount > 0 ? 'PARTIAL' : 'PENDING']
    )

    for (const item of itemsWithTotals) {
      await conn.execute(
        `INSERT INTO purchase_items (id, purchase_id, product_id, description, quantity, rate,
          discount, gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, gst_amount, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [randomUUID(), id, item.productId || null, item.description || null,
         item.quantity, item.rate, item.discount || 0, item.gstRate,
         gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
         gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
         gstType === 'IGST' ? item.gstRate : 0,
         item.cgst, item.sgst, item.igst, item.cgst + item.sgst + item.igst, item.total]
      )
      if (item.productId) {
        await conn.execute('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.productId])
        await conn.execute(
          'INSERT INTO stock_movements (id, product_id, type, quantity, reference_type, reference_id, notes) VALUES (?,?,?,?,?,?,?)',
          [randomUUID(), item.productId, 'IN', item.quantity, 'PURCHASE', id, purchaseNo]
        )
      }
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?', [id]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
