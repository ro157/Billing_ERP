import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'
import { formatCategoryName, normalizeCategoryNameKey } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('inventory', 'view')
  if (error) return error

  const conditions: string[] = []
  const params: any[] = []
  appendOrgFilter(conditions, params, organizationId!)
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [rows] = await db.execute(`SELECT * FROM categories ${where} ORDER BY BINARY name ASC`, params) as any[]
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { error, organizationId } = await requirePermission('inventory', 'create')
  if (error) return error
  try {
    const { name, description } = await req.json()
    const formattedName = formatCategoryName(String(name || ''))
    if (!formattedName) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const conditions: string[] = []
    const params: any[] = []
    appendOrgFilter(conditions, params, organizationId!)
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const [existing] = await db.execute(`SELECT name FROM categories ${where}`, params) as any[]

    const newKey = normalizeCategoryNameKey(formattedName)
    const duplicate = existing.find((row: { name: string }) => normalizeCategoryNameKey(row.name) === newKey)
    if (duplicate) {
      return NextResponse.json({ error: `Category "${duplicate.name}" already exists` }, { status: 400 })
    }

    const id = randomUUID()
    await db.execute(
      'INSERT INTO categories (id, organization_id, name, description) VALUES (?, ?, ?, ?)',
      [id, organizationId, formattedName, description || null]
    )
    const [rows] = await db.execute(
      'SELECT * FROM categories WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
