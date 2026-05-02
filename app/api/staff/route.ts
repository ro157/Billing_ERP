import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { staffSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const [users] = await db.execute(
    'SELECT id, name, email, mobile, role, branch, status, created_at FROM users ORDER BY created_at DESC'
  ) as any[]

  for (const user of users as any[]) {
    const [roles] = await db.execute(
      'SELECT r.id, r.name FROM staff_roles sr JOIN roles r ON sr.role_id = r.id WHERE sr.user_id = ?',
      [user.id]
    ) as any[]
    user.staffRoles = roles.map((r: any) => ({ role: r }))
  }

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const body = await req.json()
    const data = staffSchema.parse(body)
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [data.email]) as any[]
    if (existing[0]) return NextResponse.json({ error: 'Email already in use' }, { status: 400 })

    const password = data.password || 'Password@123'
    const hashedPassword = await bcrypt.hash(password, 12)
    const id = randomUUID()

    await db.execute(
      'INSERT INTO users (id, name, email, mobile, role, branch, status, password) VALUES (?,?,?,?,?,?,?,?)',
      [id, data.name, data.email, data.mobile||null, data.role, data.branch||null, data.status, hashedPassword]
    )

    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        await db.execute('INSERT IGNORE INTO staff_roles (id, user_id, role_id) VALUES (?,?,?)', [randomUUID(), id, roleId])
      }
    }

    const [rows] = await db.execute(
      'SELECT id, name, email, mobile, role, branch, status, created_at FROM users WHERE id = ?', [id]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
