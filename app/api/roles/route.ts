import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { roleSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const [roles] = await db.execute('SELECT * FROM roles ORDER BY created_at ASC') as any[]
  for (const role of roles as any[]) {
    const [perms] = await db.execute(
      'SELECT p.* FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?', [role.id]
    ) as any[]
    const [cnt] = await db.execute('SELECT COUNT(*) as cnt FROM staff_roles WHERE role_id = ?', [role.id]) as any[]
    role.permissions = perms.map((p: any) => ({ permission: p }))
    role._count = { staffRoles: cnt[0].cnt }
  }
  return NextResponse.json(roles)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const body = await req.json()
    const data = roleSchema.parse(body)
    const roleId = randomUUID()
    await db.execute('INSERT INTO roles (id, name, description) VALUES (?,?,?)', [roleId, data.name, data.description||null])

    for (const perm of data.permissions) {
      const [mod, action] = perm.split(':')
      const [ex] = await db.execute('SELECT id FROM permissions WHERE module=? AND action=?', [mod, action]) as any[]
      const permId = ex[0] ? ex[0].id : randomUUID()
      if (!ex[0]) await db.execute('INSERT INTO permissions (id, module, action) VALUES (?,?,?)', [permId, mod, action])
      await db.execute('INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)', [randomUUID(), roleId, permId])
    }

    const [rows] = await db.execute('SELECT * FROM roles WHERE id = ?', [roleId]) as any[]
    const [perms] = await db.execute(
      'SELECT p.* FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?', [roleId]
    ) as any[]
    rows[0].permissions = perms.map((p: any) => ({ permission: p }))
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    if (err.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Role name already exists' }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
