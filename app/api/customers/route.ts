import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'
import { customerSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'
import { apiErrorResponse } from '@/lib/api-error'

function optionalToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('customers', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR mobile LIKE ? OR phone LIKE ? OR gstin LIKE ? OR contact_person LIKE ?)')
    const s = `%${search}%`
    params.push(s, s, s, s, s, s)
  }
  appendOrgFilter(conditions, params, organizationId!)
  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  try {
    const [rows] = await db.execute(
      `SELECT * FROM customers ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM customers ${whereClause}`, params
    ) as any[]

    return NextResponse.json({ customers: rows, total: countRows[0].total, page, limit })
  } catch (err) {
    return apiErrorResponse(err, 'GET /api/customers')
  }
}

export async function POST(req: NextRequest) {
  const { error, organizationId } = await requirePermission('customers', 'create')
  if (error) return error
  try {
    const body = await req.json()
    const data = customerSchema.parse(body)
    const id = randomUUID()
    await db.execute(
      `INSERT INTO customers (id, organization_id, name, contact_person, email, mobile, phone, gstin, pan,
        billing_address, billing_city, billing_state, billing_pincode,
        shipping_address, shipping_city, shipping_state, shipping_pincode,
        credit_limit, opening_balance, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, organizationId, data.name, data.contactPerson, data.email || null, data.mobile || null, data.phone || null,
       data.gstin || null, optionalToNull(data.pan), data.billingAddress || null,
       data.billingCity || null, data.billingState || null, data.billingPincode || null,
       data.shippingAddress || null, data.shippingCity || null, data.shippingState || null,
       data.shippingPincode || null, data.creditLimit, data.openingBalance, data.isActive ? 1 : 0, data.notes || null]
    )
    const [rows] = await db.execute(
      'SELECT * FROM customers WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
