import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('billing', 'view')
  if (error) return error

  const [rows] = await db.execute(
    `SELECT i.*, c.name as customer_name, c.gstin as customer_gstin,
       c.billing_address, c.billing_city, c.billing_state, c.billing_pincode
     FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?`,
    [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute(
    'SELECT ii.*, p.sku FROM invoice_items ii LEFT JOIN products p ON ii.product_id = p.id WHERE ii.invoice_id = ?',
    [params.id]
  ) as any[]
  const [payments] = await db.execute(
    'SELECT * FROM payments WHERE reference_id = ? AND type = ? ORDER BY payment_date DESC',
    [params.id, 'INVOICE']
  ) as any[]

  return NextResponse.json({ ...rows[0], items, payments })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('billing', 'edit')
  if (error) return error
  try {
    const body = await req.json()
    const { status, paidAmount, paymentMode, paymentReference, notes } = body

    const [rows] = await db.execute('SELECT * FROM invoices WHERE id = ?', [params.id]) as any[]
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const paid = paidAmount !== undefined ? paidAmount : rows[0].paid_amount
    const balance = rows[0].total_amount - paid

    await db.execute(
      `UPDATE invoices SET status = COALESCE(?, status), paid_amount = ?, balance_amount = ?,
        payment_mode = COALESCE(?, payment_mode), notes = COALESCE(?, notes)
       WHERE id = ?`,
      [status || null, paid, balance, paymentMode || null, notes || null, params.id]
    )

    const [updated] = await db.execute(
      'SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?',
      [params.id]
    ) as any[]
    return NextResponse.json(updated[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('billing', 'delete')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [items] = await conn.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [params.id]) as any[]
    for (const item of items as any[]) {
      if (item.product_id) {
        await conn.execute('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id])
      }
    }
    await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [params.id])
    await conn.execute('DELETE FROM payments WHERE reference_id = ? AND type = ?', [params.id, 'INVOICE'])
    await conn.execute('DELETE FROM invoices WHERE id = ?', [params.id])
    await conn.commit()
    return NextResponse.json({ success: true })
  } catch {
    await conn.rollback()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
