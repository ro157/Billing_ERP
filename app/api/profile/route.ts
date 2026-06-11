import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { ensureStaffPermissionsSchema } from '@/lib/ensure-staff-permissions-schema'
import { changePasswordSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const [rows] = await db.execute(
    `SELECT id, name, email, mobile, role, status, branch, avatar, created_at, updated_at
     FROM users WHERE id = ?`,
    [session!.user.id]
  ) as any[]

  if (!rows[0]) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const user = rows[0]
  let modules: string[] = []

  if (user.role === 'STAFF') {
    try {
      await ensureStaffPermissionsSchema()
      const [modRows] = await db.execute(
        'SELECT module FROM staff_module_permissions WHERE user_id = ? ORDER BY module ASC',
        [session!.user.id]
      ) as any[]
      modules = modRows.map((r: { module: string }) => r.module)
    } catch {
      modules = []
    }
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    branch: user.branch,
    avatar: user.avatar,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    modules,
  })
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const body = await req.json()
    const data = changePasswordSchema.parse(body)

    const [rows] = await db.execute(
      'SELECT id, password FROM users WHERE id = ?',
      [session!.user.id]
    ) as any[]

    if (!rows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(data.currentPassword, rows[0].password)
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12)
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      session!.user.id,
    ])

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const msg = err.errors?.map((e: { message?: string }) => e.message).join(', ')
      return NextResponse.json({ error: msg || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
