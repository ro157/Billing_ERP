import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('vendors', 'view')
  if (error) return error

  const [rows] = await db.execute('SELECT * FROM vendors WHERE id = ?', [params.id]) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [purchases] = await db.execute(
    `SELECT id, purchase_no, date, total_amount, paid_amount, balance_amount, status
     FROM purchases WHERE vendor_id = ? ORDER BY date DESC LIMIT 20`,
    [params.id]
  ) as any[]

  return NextResponse.json({ ...rows[0], purchases })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('vendors', 'edit')
  if (error) return error
  try {
    const body = await req.json()
    const updates: string[] = []
    const values: any[] = []
    const fields: Record<string, string> = {
      name: 'name', email: 'email', mobile: 'mobile', phone: 'phone',
      gstin: 'gstin', pan: 'pan', address: 'address', city: 'city',
      state: 'state', pincode: 'pincode', creditLimit: 'credit_limit',
      openingBalance: 'opening_balance', notes: 'notes',
    }
    for (const [key, col] of Object.entries(fields)) {
      if (key in body) { updates.push(`${col} = ?`); values.push(body[key] ?? null) }
    }
    if ('isActive' in body) { updates.push('is_active = ?'); values.push(body.isActive ? 1 : 0) }
    if (updates.length > 0) {
      await db.execute(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`, [...values, params.id])
    }
    const [rows] = await db.execute('SELECT * FROM vendors WHERE id = ?', [params.id]) as any[]
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('vendors', 'delete')
  if (error) return error
  const [rows] = await db.execute('SELECT COUNT(*) as cnt FROM purchases WHERE vendor_id = ?', [params.id]) as any[]
  if (rows[0].cnt > 0) return NextResponse.json({ error: 'Cannot delete vendor with existing purchases' }, { status: 400 })
  await db.execute('DELETE FROM vendors WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
