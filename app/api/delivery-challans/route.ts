import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { challanSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('delivery-challans', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) { conditions.push('(dc.challan_no LIKE ? OR c.name LIKE ?)'); const s = `%${search}%`; params.push(s, s) }
  if (status) { conditions.push('dc.status = ?'); params.push(status) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await db.execute(
    `SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id
     ${where} ORDER BY dc.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id ${where}`, params
  ) as any[]

  return NextResponse.json({ challans: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('delivery-challans', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = challanSchema.parse(body)
    await conn.beginTransaction()

    const [settings] = await conn.execute('SELECT challan_prefix FROM business_settings LIMIT 1') as any[]
    const prefix = settings[0]?.challan_prefix || 'DC'
    const [last] = await conn.execute(
      'SELECT challan_no FROM delivery_challans WHERE challan_no LIKE ? ORDER BY created_at DESC LIMIT 1', [`${prefix}%`]
    ) as any[]
    let nextNum = 1
    if (last[0]) { const m = last[0].challan_no.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1 }
    const challanNo = `${prefix}${String(nextNum).padStart(4, '0')}`

    const id = randomUUID()
    await conn.execute(
      'INSERT INTO delivery_challans (id, challan_no, customer_id, date, vehicle_no, notes, status) VALUES (?,?,?,?,?,?,?)',
      [id, challanNo, data.customerId, data.date, data.vehicleNo || null, data.notes || null, 'PENDING']
    )

    for (const item of data.items) {
      let productName = item.description || 'Item'
      if (item.productId) {
        const [prod] = await conn.execute('SELECT name FROM products WHERE id = ?', [item.productId]) as any[]
        if (prod[0]) productName = prod[0].name
      }
      await conn.execute(
        'INSERT INTO challan_items (id, challan_id, product_id, description, quantity, rate, gst_rate, gst_amount, amount) VALUES (?,?,?,?,?,?,?,?,?)',
        [randomUUID(), id, item.productId || null, item.description || productName,
         item.quantity, item.rate || 0, item.gstRate || 0,
         (item.quantity * (item.rate || 0) * (item.gstRate || 0) / 100),
         item.quantity * (item.rate || 0) * (1 + (item.gstRate || 0) / 100)]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id WHERE dc.id = ?', [id]
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
