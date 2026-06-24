import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'
import { challanSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'
import { buildDocumentNumberPrefix, documentSerialSubstringStart, nextDocumentNumber } from '@/lib/document-number'
import { ensureDeliveryChallanSchema } from '@/lib/ensure-delivery-challan-schema'
import { computeSalesDocumentItemTotals } from '@/lib/sales-document-totals'

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('delivery-challans', 'view')
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
  appendOrgFilter(conditions, params, organizationId!, 'dc')

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
  const { error, organizationId } = await requirePermission('delivery-challans', 'create')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensureDeliveryChallanSchema()
    const body = await req.json()
    const data = challanSchema.parse(body)
    await conn.beginTransaction()

    const [settings] = await conn.execute(
      'SELECT challan_prefix FROM business_settings WHERE organization_id = ? LIMIT 1',
      [organizationId]
    ) as any[]
    const prefix = settings[0]?.challan_prefix || 'DC'
    const numberPrefix = buildDocumentNumberPrefix(prefix, data.date)
    const [last] = await conn.execute(
      `SELECT challan_no FROM delivery_challans WHERE organization_id = ? AND challan_no LIKE ? ORDER BY CAST(SUBSTRING(challan_no, ?) AS UNSIGNED) DESC LIMIT 1`,
      [organizationId, `${numberPrefix}%`, documentSerialSubstringStart(numberPrefix)]
    ) as any[]
    const challanNo = nextDocumentNumber(prefix, data.date, last[0]?.challan_no)
    const partyDetailsJson = data.partyDetails ? JSON.stringify(data.partyDetails) : null

    const id = randomUUID()
    await conn.execute(
      `INSERT INTO delivery_challans (
        id, organization_id, challan_no, customer_id, date, completion_date, party_details, terms, status
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        organizationId,
        challanNo,
        data.customerId,
        data.date,
        data.completionDate || null,
        partyDetailsJson,
        data.terms || null,
        'PENDING',
      ]
    )

    for (const item of data.items) {
      let productName = item.description || 'Item'
      if (item.productId) {
        const [prod] = await conn.execute(
          'SELECT name FROM products WHERE id = ? AND organization_id = ?',
          [item.productId, organizationId]
        ) as any[]
        if (prod[0]) productName = prod[0].name
      }
      const totals = computeSalesDocumentItemTotals(
        {
          quantity: item.quantity,
          rate: item.rate || 0,
          discount: item.discount || 0,
          gstRate: item.gstRate || 0,
        },
        'CGST_SGST'
      )
      await conn.execute(
        'INSERT INTO challan_items (id, challan_id, product_id, description, quantity, rate, discount, gst_rate, gst_amount, amount) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          id,
          item.productId || null,
          item.description || productName,
          item.quantity,
          item.rate || 0,
          item.discount || 0,
          item.gstRate || 0,
          totals.cgst + totals.sgst + totals.igst,
          totals.total,
        ]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id WHERE dc.id = ? AND dc.organization_id = ?',
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
