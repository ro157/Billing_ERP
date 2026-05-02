import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { quotationSchema } from '@/lib/validations'
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
  const { error } = await requirePermission('quotations', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) { conditions.push('(q.quotation_no LIKE ? OR c.name LIKE ?)'); const s = `%${search}%`; params.push(s, s) }
  if (status) { conditions.push('q.status = ?'); params.push(status) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await db.execute(
    `SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id
     ${where} ORDER BY q.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id ${where}`, params
  ) as any[]

  return NextResponse.json({ quotations: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('quotations', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = quotationSchema.parse(body)
    await conn.beginTransaction()

    const [settings] = await conn.execute('SELECT quot_prefix FROM business_settings LIMIT 1') as any[]
    const prefix = settings[0]?.quot_prefix || 'QT'
    const [last] = await conn.execute(
      'SELECT quotation_no FROM quotations WHERE quotation_no LIKE ? ORDER BY created_at DESC LIMIT 1', [`${prefix}%`]
    ) as any[]
    let nextNum = 1
    if (last[0]) { const m = last[0].quotation_no.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1 }
    const quotationNo = `${prefix}${String(nextNum).padStart(4, '0')}`

    let subtotal = 0, totalDiscount = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal = 0
    const itemsWithTotals = data.items.map((item: any) => {
      const t = computeItemTotals(item, data.gstType)
      subtotal += item.quantity * item.rate; totalDiscount += t.discAmt; totalTaxable += t.taxable
      totalCgst += t.cgst; totalSgst += t.sgst; totalIgst += t.igst; grandTotal += t.total
      return { ...item, ...t }
    })

    const id = randomUUID()
    await conn.execute(
      `INSERT INTO quotations (id, quotation_no, customer_id, date, valid_until, subtotal,
        discount_amount, tax_amount, total_amount, notes, terms, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, quotationNo, data.customerId, data.date, data.validUntil || null,
       subtotal, totalDiscount, totalCgst + totalSgst + totalIgst, grandTotal,
       data.notes || null, data.terms || null, 'DRAFT']
    )

    for (const item of itemsWithTotals) {
      await conn.execute(
        `INSERT INTO quotation_items (id, quotation_id, product_id, description, quantity, rate,
          discount, gst_rate, gst_amount, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [randomUUID(), id, item.productId || null, item.description || null,
         item.quantity, item.rate, item.discount || 0, item.gstRate,
         item.cgst + item.sgst + item.igst, item.total]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id WHERE q.id = ?', [id]
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
