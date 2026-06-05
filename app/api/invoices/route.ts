import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { invoiceSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

function computeItemTotals(item: any, gstType: string) {
  const taxable = item.quantity * item.rate * (1 - (item.discount || 0) / 100)
  let cgst = 0, sgst = 0, igst = 0
  if (gstType === 'CGST_SGST') { cgst = taxable * item.gstRate / 200; sgst = cgst }
  else if (gstType === 'IGST') { igst = taxable * item.gstRate / 100 }
  const total = taxable + cgst + sgst + igst
  const discAmt = item.quantity * item.rate - taxable
  return { taxable, cgst, sgst, igst, total, discAmt }
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('billing', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')
  const fromDate = searchParams.get('fromDate')
  const toDate = searchParams.get('toDate')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) { conditions.push('(i.invoice_no LIKE ? OR c.name LIKE ?)'); const s = `%${search}%`; params.push(s, s) }
  if (status) { conditions.push('i.status = ?'); params.push(status) }
  if (customerId) { conditions.push('i.customer_id = ?'); params.push(customerId) }
  if (fromDate) { conditions.push('i.date >= ?'); params.push(fromDate) }
  if (toDate) { conditions.push('i.date <= ?'); params.push(toDate) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await db.execute(
    `SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
     ${where} ORDER BY i.date DESC, i.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id ${where}`, params
  ) as any[]

  return NextResponse.json({ invoices: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('billing', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = invoiceSchema.parse(body)
    const gstType = data.gstType
    await conn.beginTransaction()

    // Generate invoice number
    const [settings] = await conn.execute('SELECT invoice_prefix FROM business_settings LIMIT 1') as any[]
    const prefix = settings[0]?.invoice_prefix || 'INV'
    const [lastInv] = await conn.execute(
      'SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY created_at DESC LIMIT 1', [`${prefix}%`]
    ) as any[]
    let nextNum = 1
    if (lastInv[0]) { const m = lastInv[0].invoice_no.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1 }
    const invoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`

    // Compute totals
    let subtotal = 0, totalDiscount = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal = 0
    const itemsWithTotals = data.items.map((item: any) => {
      const gross = item.quantity * item.rate
      const t = computeItemTotals(item, gstType)
      subtotal += gross; totalDiscount += t.discAmt; totalTaxable += t.taxable
      totalCgst += t.cgst; totalSgst += t.sgst; totalIgst += t.igst; grandTotal += t.total
      return { ...item, ...t }
    })

    const id = randomUUID()
    await conn.execute(
      `INSERT INTO invoices (id, invoice_no, customer_id, date, due_date, gst_type, place_of_supply,
        subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, tax_amount, total_amount,
        paid_amount, balance_amount, payment_mode, notes, terms, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, invoiceNo, data.customerId, data.date, data.dueDate || null,
       gstType, data.placeOfSupply || null,
       subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalCgst + totalSgst + totalIgst, grandTotal,
       data.paidAmount, grandTotal - data.paidAmount,
       data.paymentMode || null, data.notes || null, data.terms || null,
       grandTotal - data.paidAmount <= 0 ? 'PAID' : data.paidAmount > 0 ? 'PARTIAL' : 'DRAFT']
    )

    for (const item of itemsWithTotals) {
      await conn.execute(
        `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, rate,
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
        await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.productId])
        const [[stockRow]] = await conn.execute(
          'SELECT current_stock FROM products WHERE id = ?',
          [item.productId]
        ) as any[][]
        await conn.execute(
          'INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_type, reference_id, note) VALUES (?,?,?,?,?,?,?,?)',
          [randomUUID(), item.productId, 'OUT', item.quantity, stockRow.current_stock, 'INVOICE', id, invoiceNo]
        )
      }
    }

    if (data.paidAmount > 0) {
      await conn.execute(
        'INSERT INTO payments (id, type, reference_id, reference_no, amount, payment_mode, payment_date) VALUES (?,?,?,?,?,?,?)',
        [randomUUID(), 'INVOICE', id, invoiceNo, data.paidAmount, data.paymentMode || 'CASH', data.date]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?', [id]
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
