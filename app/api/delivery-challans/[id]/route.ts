import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

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
  try {
    const { status, vehicleNo, notes } = await req.json()
    const [existing] = await db.execute(
      'SELECT id FROM delivery_challans WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.execute(
      'UPDATE delivery_challans SET status=COALESCE(?,status), vehicle_no=COALESCE(?,vehicle_no), notes=COALESCE(?,notes) WHERE id=? AND organization_id = ?',
      [status||null, vehicleNo||null, notes||null, params.id, organizationId]
    )
    const [rows] = await db.execute(
      'SELECT dc.*, c.name as customer_name FROM delivery_challans dc LEFT JOIN customers c ON dc.customer_id = c.id WHERE dc.id = ? AND dc.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
