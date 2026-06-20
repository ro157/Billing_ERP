import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { staffSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

async function getOrgMember(userId: string, organizationId: string) {
  const [rows] = await db.execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.role, u.branch, u.status, u.created_at
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ? AND om.user_id = ? AND om.status = 'ACTIVE'`,
    [organizationId, userId]
  ) as any[]
  return rows[0] || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  const user = await getOrgMember(params.id, organizationId!)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [roles] = await db.execute(
    `SELECT r.id, r.name FROM staff_roles sr
     JOIN roles r ON sr.role_id = r.id
     WHERE sr.user_id = ? AND r.organization_id = ?`,
    [params.id, organizationId]
  ) as any[]
  user.staffRoles = roles.map((r: any) => ({ role: r }))
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requireAdmin()
  if (error) return error
  try {
    const existing = await getOrgMember(params.id, organizationId!)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const data = staffSchema.partial().parse(body)

    if (data.roleIds !== undefined) {
      await db.execute('DELETE FROM staff_roles WHERE user_id = ?', [params.id])
      for (const roleId of data.roleIds) {
        const [roleRow] = await db.execute(
          'SELECT id FROM roles WHERE id = ? AND organization_id = ?',
          [roleId, organizationId]
        ) as any[]
        if (roleRow[0]) {
          await db.execute('INSERT IGNORE INTO staff_roles (id, user_id, role_id) VALUES (?,?,?)', [randomUUID(), params.id, roleId])
        }
      }
    }

    if (data.email) {
      const [emailInUse] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [data.email, params.id]
      ) as any[]
      if (emailInUse[0]) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    const updates: string[] = []
    const values: any[] = []
    if (data.name) { updates.push('name = ?'); values.push(data.name) }
    if (data.email) { updates.push('email = ?'); values.push(data.email) }
    if (data.mobile !== undefined) { updates.push('mobile = ?'); values.push(data.mobile || null) }
    if (data.role) { updates.push('role = ?'); values.push(data.role) }
    if (data.branch !== undefined) { updates.push('branch = ?'); values.push(data.branch || null) }
    if (data.status) { updates.push('status = ?'); values.push(data.status) }
    if (data.password) { updates.push('password = ?'); values.push(await bcrypt.hash(data.password, 12)) }

    if (updates.length > 0) {
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, params.id])
    }

    const [rows] = await db.execute(
      'SELECT id, name, email, mobile, role, branch, status, created_at FROM users WHERE id = ?',
      [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const message = err.errors?.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || 'Validation failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session, organizationId } = await requireAdmin()
  if (error) return error
  if (params.id === session!.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const existing = await getOrgMember(params.id, organizationId!)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute(
    'DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?',
    [organizationId, params.id]
  )

  const [otherMemberships] = await db.execute(
    'SELECT id FROM organization_members WHERE user_id = ? LIMIT 1',
    [params.id]
  ) as any[]
  if (!otherMemberships[0]) {
    await db.execute('DELETE FROM users WHERE id = ?', [params.id])
  }

  return NextResponse.json({ success: true })
}
