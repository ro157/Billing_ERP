import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('purchases', 'view')
  if (error) return error

  const [rows] = await db.execute(
    'SELECT p.*, v.name as vendor_name, v.gstin as vendor_gstin FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?',
    [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('purchases', 'edit')
  if (error) return error
  try {
    const { status, paidAmount, paymentMode, notes } = await req.json()
    const [rows] = await db.execute('SELECT * FROM purchases WHERE id = ?', [params.id]) as any[]
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const paid = paidAmount !== undefined ? paidAmount : rows[0].paid_amount
    const balance = rows[0].total_amount - paid

    await db.execute(
      'UPDATE purchases SET status=COALESCE(?,status), paid_amount=?, balance_amount=?, payment_mode=COALESCE(?,payment_mode), notes=COALESCE(?,notes) WHERE id=?',
      [status || null, paid, balance, paymentMode || null, notes || null, params.id]
    )
    const [updated] = await db.execute(
      'SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?', [params.id]
    ) as any[]
    return NextResponse.json(updated[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('purchases', 'delete')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [items] = await conn.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', [params.id]) as any[]
    for (const item of items as any[]) {
      if (item.product_id) {
        await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id])
      }
    }
    await conn.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [params.id])
    await conn.execute('DELETE FROM purchases WHERE id = ?', [params.id])
    await conn.commit()
    return NextResponse.json({ success: true })
  } catch {
    await conn.rollback()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
