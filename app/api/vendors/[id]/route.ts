import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { vendorSchema } from '@/lib/validations'
import { ensureVendorContactPersonColumn } from '@/lib/ensure-vendor-schema'

function optionalToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

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
    await ensureVendorContactPersonColumn()
    const body = await req.json()
    const data = vendorSchema.parse(body)

    await db.execute(
      `UPDATE vendors SET
        name = ?, contact_person = ?, email = ?, mobile = ?, phone = ?, gstin = ?, pan = ?,
        address = ?, city = ?, state = ?, pincode = ?,
        credit_limit = ?, opening_balance = ?, is_active = ?, notes = ?
       WHERE id = ?`,
      [
        data.name,
        data.contactPerson,
        optionalToNull(data.email),
        optionalToNull(data.mobile),
        data.phone,
        data.gstin,
        optionalToNull(data.pan),
        data.address,
        optionalToNull(data.city),
        optionalToNull(data.state),
        optionalToNull(data.pincode),
        data.creditLimit,
        data.openingBalance,
        data.isActive ? 1 : 0,
        optionalToNull(data.notes),
        params.id,
      ]
    )

    const [rows] = await db.execute('SELECT * FROM vendors WHERE id = ?', [params.id]) as any[]
    return NextResponse.json(rows[0])
  } catch (err: unknown) {
    const e = err as { name?: string; errors?: unknown }
    if (e?.name === 'ZodError') return NextResponse.json({ error: e.errors }, { status: 400 })
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
