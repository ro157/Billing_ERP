import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { staffSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error

  const [rows] = await db.execute(
    'SELECT id, name, email, mobile, role, branch, status, created_at FROM users WHERE id = ?', [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [roles] = await db.execute(
    'SELECT r.id, r.name FROM staff_roles sr JOIN roles r ON sr.role_id = r.id WHERE sr.user_id = ?', [params.id]
  ) as any[]
  rows[0].staffRoles = roles.map((r: any) => ({ role: r }))
  return NextResponse.json(rows[0])
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const body = await req.json()
    const data = staffSchema.partial().parse(body)

    if (data.roleIds !== undefined) {
      await db.execute('DELETE FROM staff_roles WHERE user_id = ?', [params.id])
      for (const roleId of data.roleIds) {
        await db.execute('INSERT IGNORE INTO staff_roles (id, user_id, role_id) VALUES (?,?,?)', [randomUUID(), params.id, roleId])
      }
    }

    const updates: string[] = []
    const values: any[] = []
    if (data.name) { updates.push('name = ?'); values.push(data.name) }
    if (data.mobile !== undefined) { updates.push('mobile = ?'); values.push(data.mobile || null) }
    if (data.role) { updates.push('role = ?'); values.push(data.role) }
    if (data.branch !== undefined) { updates.push('branch = ?'); values.push(data.branch || null) }
    if (data.status) { updates.push('status = ?'); values.push(data.status) }
    if (data.password) { updates.push('password = ?'); values.push(await bcrypt.hash(data.password, 12)) }

    if (updates.length > 0) {
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, params.id])
    }

    const [rows] = await db.execute(
      'SELECT id, name, email, mobile, role, branch, status, created_at FROM users WHERE id = ?', [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAdmin()
  if (error) return error
  if (params.id === session!.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  await db.execute('DELETE FROM users WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
