import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'
import { vendorSchema } from '@/lib/validations'
import { ensureVendorContactPersonColumn } from '@/lib/ensure-vendor-schema'
import { randomUUID } from 'crypto'
import { apiErrorResponse } from '@/lib/api-error'

function optionalToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('vendors', 'view')
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
      `SELECT * FROM vendors ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM vendors ${whereClause}`, params
    ) as any[]

    return NextResponse.json({ vendors: rows, total: countRows[0].total, page, limit })
  } catch (err) {
    return apiErrorResponse(err, 'GET /api/vendors')
  }
}

export async function POST(req: NextRequest) {
  const { error, organizationId } = await requirePermission('vendors', 'create')
  if (error) return error
  try {
    await ensureVendorContactPersonColumn()
    const body = await req.json()
    const data = vendorSchema.parse(body)
    const id = randomUUID()
    await db.execute(
      `INSERT INTO vendors (id, organization_id, name, contact_person, email, mobile, phone, gstin, pan,
        address, city, state, pincode, credit_limit, opening_balance, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, organizationId, data.name, data.contactPerson, optionalToNull(data.email), optionalToNull(data.mobile), data.phone,
       data.gstin, optionalToNull(data.pan), data.address,
       optionalToNull(data.city), optionalToNull(data.state), optionalToNull(data.pincode),
       data.creditLimit, data.openingBalance, data.isActive ? 1 : 0, optionalToNull(data.notes)]
    )
    const [rows] = await db.execute(
      'SELECT * FROM vendors WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
