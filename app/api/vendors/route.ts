import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { vendorSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('vendors', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  let whereClause = ''
  let params: any[] = []
  if (search) {
    whereClause = 'WHERE (name LIKE ? OR email LIKE ? OR mobile LIKE ? OR gstin LIKE ?)'
    const s = `%${search}%`
    params = [s, s, s, s]
  }

  const [rows] = await db.execute(
    `SELECT * FROM vendors ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]
  const [countRows] = await db.execute(
    `SELECT COUNT(*) as total FROM vendors ${whereClause}`, params
  ) as any[]

  return NextResponse.json({ vendors: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('vendors', 'create')
  if (error) return error
  try {
    const body = await req.json()
    const data = vendorSchema.parse(body)
    const id = randomUUID()
    await db.execute(
      `INSERT INTO vendors (id, name, email, mobile, phone, gstin, pan,
        address, city, state, pincode, credit_limit, opening_balance, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email || null, data.mobile || null, data.phone || null,
       data.gstin || null, data.pan || null, data.address || null,
       data.city || null, data.state || null, data.pincode || null,
       data.creditLimit, data.openingBalance, data.isActive ? 1 : 0, data.notes || null]
    )
    const [rows] = await db.execute('SELECT * FROM vendors WHERE id = ?', [id]) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
