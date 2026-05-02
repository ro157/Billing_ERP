import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { purchaseOrderSchema } from '@/lib/validations'
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
  const { error } = await requirePermission('purchase-orders', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) { conditions.push('(po.po_no LIKE ? OR v.name LIKE ?)'); const s = `%${search}%`; params.push(s, s) }
  if (status) { conditions.push('po.status = ?'); params.push(status) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await db.execute(
    `SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id
     ${where} ORDER BY po.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id ${where}`, params
  ) as any[]

  return NextResponse.json({ purchaseOrders: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('purchase-orders', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = purchaseOrderSchema.parse(body)
    await conn.beginTransaction()

    const [settings] = await conn.execute('SELECT po_prefix FROM business_settings LIMIT 1') as any[]
    const prefix = settings[0]?.po_prefix || 'PO'
    const [last] = await conn.execute(
      'SELECT po_no FROM purchase_orders WHERE po_no LIKE ? ORDER BY created_at DESC LIMIT 1', [`${prefix}%`]
    ) as any[]
    let nextNum = 1
    if (last[0]) { const m = last[0].po_no.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1 }
    const poNo = `${prefix}${String(nextNum).padStart(4, '0')}`

    let subtotal = 0, totalDiscount = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal = 0
    const itemsWithTotals = data.items.map((item: any) => {
      const t = computeItemTotals(item)
      subtotal += item.quantity * item.rate; totalDiscount += t.discAmt; totalTaxable += t.taxable
      totalCgst += t.cgst; totalSgst += t.sgst; totalIgst += t.igst; grandTotal += t.total
      return { ...item, ...t }
    })

    const id = randomUUID()
    await conn.execute(
      `INSERT INTO purchase_orders (id, po_no, vendor_id, date, expected_date, subtotal,
        discount_amount, tax_amount, total_amount, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, poNo, data.vendorId, data.date, data.expectedDate || null,
       subtotal, totalDiscount, totalCgst + totalSgst + totalIgst, grandTotal,
       data.notes || null, 'PENDING']
    )

    for (const item of itemsWithTotals) {
      await conn.execute(
        `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, received_qty,
          rate, discount, gst_rate, gst_amount, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [randomUUID(), id, item.productId || null, item.description || null,
         item.quantity, 0, item.rate, item.discount || 0, item.gstRate,
         item.cgst + item.sgst + item.igst, item.total]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ?', [id]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
