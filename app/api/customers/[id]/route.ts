import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { customerSchema } from '@/lib/validations'

function optionalToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('customers', 'view')
  if (error) return error

  const [rows] = await db.execute(
    'SELECT * FROM customers WHERE id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [invoices] = await db.execute(
    `SELECT id, invoice_no, date, total_amount, paid_amount, balance_amount, status
     FROM invoices WHERE customer_id = ? AND organization_id = ? ORDER BY date DESC LIMIT 20`,
    [params.id, organizationId]
  ) as any[]

  return NextResponse.json({ ...rows[0], invoices })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('customers', 'edit')
  if (error) return error
  try {
    const body = await req.json()
    const data = customerSchema.parse(body)

    const [existing] = await db.execute(
      'SELECT id FROM customers WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.execute(
      `UPDATE customers SET
        name = ?, contact_person = ?, email = ?, mobile = ?, phone = ?, gstin = ?, pan = ?,
        billing_address = ?, billing_city = ?, billing_state = ?, billing_pincode = ?,
        shipping_address = ?, shipping_city = ?, shipping_state = ?, shipping_pincode = ?,
        credit_limit = ?, opening_balance = ?, is_active = ?, notes = ?
       WHERE id = ? AND organization_id = ?`,
      [
        data.name,
        data.contactPerson,
        optionalToNull(data.email),
        optionalToNull(data.mobile),
        data.phone,
        data.gstin,
        optionalToNull(data.pan),
        data.billingAddress,
        optionalToNull(data.billingCity),
        optionalToNull(data.billingState),
        optionalToNull(data.billingPincode),
        optionalToNull(data.shippingAddress),
        optionalToNull(data.shippingCity),
        optionalToNull(data.shippingState),
        optionalToNull(data.shippingPincode),
        data.creditLimit,
        data.openingBalance,
        data.isActive ? 1 : 0,
        optionalToNull(data.notes),
        params.id,
        organizationId,
      ]
    )

    const [rows] = await db.execute(
      'SELECT * FROM customers WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: unknown) {
    const e = err as { name?: string; errors?: unknown }
    if (e?.name === 'ZodError') return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('customers', 'delete')
  if (error) return error

  const [existing] = await db.execute(
    'SELECT id FROM customers WHERE id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [rows] = await db.execute(
    'SELECT COUNT(*) as cnt FROM invoices WHERE customer_id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (rows[0].cnt > 0) return NextResponse.json({ error: 'Cannot delete customer with existing invoices' }, { status: 400 })
  await db.execute('DELETE FROM customers WHERE id = ? AND organization_id = ?', [params.id, organizationId])
  return NextResponse.json({ success: true })
}
