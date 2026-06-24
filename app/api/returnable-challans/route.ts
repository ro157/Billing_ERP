import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'
import { challanSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'
import { buildDocumentNumberPrefix, documentSerialSubstringStart, nextDocumentNumber } from '@/lib/document-number'

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('returnable-challans', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  appendOrgFilter(conditions, params, organizationId!, 'rc')
  const where = 'WHERE ' + conditions.join(' AND ')

  const [rows] = await db.execute(
    `SELECT rc.*, c.name as customer_name FROM returnable_challans rc LEFT JOIN customers c ON rc.customer_id = c.id
     ${where} ORDER BY rc.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM returnable_challans rc ${where}`,
    params
  ) as any[]

  return NextResponse.json({ challans: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error, organizationId } = await requirePermission('returnable-challans', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const body = await req.json()
    const data = challanSchema.parse(body)
    await conn.beginTransaction()

    const prefix = 'RC'
    const numberPrefix = buildDocumentNumberPrefix(prefix, data.date)
    const [last] = await conn.execute(
      `SELECT challan_no FROM returnable_challans WHERE organization_id = ? AND challan_no LIKE ? ORDER BY CAST(SUBSTRING(challan_no, ?) AS UNSIGNED) DESC LIMIT 1`,
      [organizationId, `${numberPrefix}%`, documentSerialSubstringStart(numberPrefix)]
    ) as any[]
    const challanNo = nextDocumentNumber(prefix, data.date, last[0]?.challan_no)

    const id = randomUUID()
    await conn.execute(
      'INSERT INTO returnable_challans (id, organization_id, challan_no, customer_id, date, vehicle_no, destination, notes, status) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, organizationId, challanNo, data.customerId, data.date, data.vehicleNo || null, data.destination || null, data.notes || null, 'PENDING']
    )

    for (const item of data.items) {
      await conn.execute(
        'INSERT INTO returnable_challan_items (id, challan_id, product_id, description, quantity_issued, quantity_returned, rate, gst_rate, gst_amount, amount) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [randomUUID(), id, item.productId || null, item.description || null,
         item.quantity, 0, item.rate || 0, item.gstRate || 0,
         item.quantity * (item.rate || 0) * (item.gstRate || 0) / 100,
         item.quantity * (item.rate || 0)]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT rc.*, c.name as customer_name FROM returnable_challans rc LEFT JOIN customers c ON rc.customer_id = c.id WHERE rc.id = ? AND rc.organization_id = ?',
      [id, organizationId]
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
