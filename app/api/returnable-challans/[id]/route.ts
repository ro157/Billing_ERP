import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('returnable-challans', 'view')
  if (error) return error

  const [rows] = await db.execute(
    'SELECT rc.*, c.name as customer_name FROM returnable_challans rc LEFT JOIN customers c ON rc.customer_id = c.id WHERE rc.id = ?',
    [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM returnable_challan_items WHERE challan_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('returnable-challans', 'edit')
  if (error) return error
  try {
    const { status, notes } = await req.json()
    await db.execute('UPDATE returnable_challans SET status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?',
      [status||null, notes||null, params.id])
    const [rows] = await db.execute(
      'SELECT rc.*, c.name as customer_name FROM returnable_challans rc LEFT JOIN customers c ON rc.customer_id = c.id WHERE rc.id = ?', [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('returnable-challans', 'delete')
  if (error) return error
  await db.execute('DELETE FROM returnable_challan_items WHERE challan_id = ?', [params.id])
  await db.execute('DELETE FROM returnable_challans WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
