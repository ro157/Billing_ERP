import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'view')
  if (error) return error

  const [rows] = await db.execute(
    'SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ? AND po.organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'edit')
  if (error) return error
  try {
    const { status, notes } = await req.json()
    const [existing] = await db.execute(
      'SELECT id FROM purchase_orders WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.execute(
      'UPDATE purchase_orders SET status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=? AND organization_id = ?',
      [status || null, notes || null, params.id, organizationId]
    )
    const [rows] = await db.execute(
      'SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ? AND po.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'delete')
  if (error) return error

  const [existing] = await db.execute(
    'SELECT id FROM purchase_orders WHERE id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [params.id])
  await db.execute('DELETE FROM purchase_orders WHERE id = ? AND organization_id = ?', [params.id, organizationId])
  return NextResponse.json({ success: true })
}
