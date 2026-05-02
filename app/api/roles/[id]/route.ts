import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { roleSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error
  const [rows] = await db.execute('SELECT * FROM roles WHERE id = ?', [params.id]) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [perms] = await db.execute(
    'SELECT p.* FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?', [params.id]
  ) as any[]
  const [cnt] = await db.execute('SELECT COUNT(*) as cnt FROM staff_roles WHERE role_id = ?', [params.id]) as any[]
  rows[0].permissions = perms.map((p: any) => ({ permission: p }))
  rows[0]._count = { staffRoles: cnt[0].cnt }
  return NextResponse.json(rows[0])
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const body = await req.json()
    const data = roleSchema.parse(body)
    await db.execute('UPDATE roles SET name=?, description=? WHERE id=?', [data.name, data.description||null, params.id])
    await db.execute('DELETE FROM role_permissions WHERE role_id = ?', [params.id])
    for (const perm of data.permissions) {
      const [mod, action] = perm.split(':')
      const [ex] = await db.execute('SELECT id FROM permissions WHERE module=? AND action=?', [mod, action]) as any[]
      const permId = ex[0] ? ex[0].id : randomUUID()
      if (!ex[0]) await db.execute('INSERT INTO permissions (id, module, action) VALUES (?,?,?)', [permId, mod, action])
      await db.execute('INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)', [randomUUID(), params.id, permId])
    }
    const [rows] = await db.execute('SELECT * FROM roles WHERE id = ?', [params.id]) as any[]
    const [perms] = await db.execute(
      'SELECT p.* FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?', [params.id]
    ) as any[]
    rows[0].permissions = perms.map((p: any) => ({ permission: p }))
    return NextResponse.json(rows[0])
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error
  const [rows] = await db.execute('SELECT id FROM roles WHERE id = ?', [params.id]) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [cnt] = await db.execute('SELECT COUNT(*) as cnt FROM staff_roles WHERE role_id = ?', [params.id]) as any[]
  if (cnt[0].cnt > 0) return NextResponse.json({ error: 'Role is assigned to staff members' }, { status: 400 })
  await db.execute('DELETE FROM roles WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
