import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('inventory', 'view')
  if (error) return error
  const [rows] = await db.execute('SELECT * FROM brands ORDER BY name ASC') as any[]
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('inventory', 'create')
  if (error) return error
  try {
    const { name, description } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const id = randomUUID()
    await db.execute('INSERT INTO brands (id, name, description) VALUES (?, ?, ?)', [id, name, description || null])
    const [rows] = await db.execute('SELECT * FROM brands WHERE id = ?', [id]) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Brand already exists' }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
