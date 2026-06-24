import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { challanSchema } from '@/lib/validations'
import { ensureDeliveryChallanSchema } from '@/lib/ensure-delivery-challan-schema'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('delivery-challans', 'view')
  if (error) return error

  const [rows] = await db.execute(
    'SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id WHERE dc.id = ? AND dc.organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM challan_items WHERE challan_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('delivery-challans', 'edit')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensureDeliveryChallanSchema()
    const body = await req.json()
    const data = challanSchema.parse(body)

    const [existingRows] = await conn.execute(
      'SELECT id FROM delivery_challans WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await conn.beginTransaction()

    const partyDetailsJson = data.partyDetails ? JSON.stringify(data.partyDetails) : null

    await conn.execute(
      `UPDATE delivery_challans SET customer_id=?, date=?, completion_date=?, party_details=?, terms=?
       WHERE id=? AND organization_id = ?`,
      [
        data.customerId,
        data.date,
        data.completionDate || null,
        partyDetailsJson,
        data.terms || null,
        params.id,
        organizationId,
      ]
    )

    await conn.execute('DELETE FROM challan_items WHERE challan_id = ?', [params.id])

    for (const item of data.items) {
      let productName = item.description || 'Item'
      if (item.productId) {
        const [prod] = await conn.execute(
          'SELECT name FROM products WHERE id = ? AND organization_id = ?',
          [item.productId, organizationId]
        ) as any[]
        if (prod[0]) productName = prod[0].name
      }
      await conn.execute(
        'INSERT INTO challan_items (id, challan_id, product_id, description, quantity, rate, gst_rate, gst_amount, amount) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          params.id,
          item.productId || null,
          item.description || productName,
          item.quantity,
          item.rate || 0,
          item.gstRate || 0,
          (item.quantity * (item.rate || 0) * (item.gstRate || 0)) / 100,
          item.quantity * (item.rate || 0) * (1 + (item.gstRate || 0) / 100),
        ]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id WHERE dc.id = ? AND dc.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    const [items] = await db.execute('SELECT * FROM challan_items WHERE challan_id = ?', [params.id]) as any[]
    return NextResponse.json({ ...rows[0], items })
  } catch (err: unknown) {
    await conn.rollback()
    const e = err as { name?: string; errors?: unknown }
    if (e.name === 'ZodError') return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error('PUT /api/delivery-challans/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('delivery-challans', 'delete')
  if (error) return error

  const [existing] = await db.execute(
    'SELECT id FROM delivery_challans WHERE id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute('DELETE FROM challan_items WHERE challan_id = ?', [params.id])
  await db.execute('DELETE FROM delivery_challans WHERE id = ? AND organization_id = ?', [params.id, organizationId])
  return NextResponse.json({ success: true })
}
