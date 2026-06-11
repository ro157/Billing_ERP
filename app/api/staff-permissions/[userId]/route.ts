import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { ensureStaffPermissionsSchema } from '@/lib/ensure-staff-permissions-schema'
import { STAFF_ASSIGNABLE_MODULES } from '@/lib/permissions'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const updateSchema = z.object({
  modules: z.array(z.string()),
})

async function getStaffPermission(userId: string) {
  const [users] = await db.execute(
    "SELECT id, name, email, role, status FROM users WHERE id = ? AND role = 'STAFF'",
    [userId]
  ) as any[]
  if (!users[0]) return null

  const [mods] = await db.execute(
    'SELECT module FROM staff_module_permissions WHERE user_id = ? ORDER BY module ASC',
    [userId]
  ) as any[]

  return {
    ...users[0],
    modules: mods.map((m: any) => m.module),
    moduleCount: mods.length,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const record = await getStaffPermission(params.userId)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    await ensureStaffPermissionsSchema()
    const body = await req.json()
    const data = updateSchema.parse(body)

    const [userRows] = await db.execute(
      "SELECT id FROM users WHERE id = ? AND role = 'STAFF'",
      [params.userId]
    ) as any[]
    if (!userRows[0]) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const validModules = data.modules.filter((m) =>
      (STAFF_ASSIGNABLE_MODULES as readonly string[]).includes(m)
    )

    await db.execute('DELETE FROM staff_module_permissions WHERE user_id = ?', [params.userId])
    for (const mod of validModules) {
      await db.execute(
        'INSERT INTO staff_module_permissions (id, user_id, module) VALUES (?,?,?)',
        [randomUUID(), params.userId, mod]
      )
    }

    const record = await getStaffPermission(params.userId)
    return NextResponse.json(record)
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const [userRows] = await db.execute(
    "SELECT id FROM users WHERE id = ? AND role = 'STAFF'",
    [params.userId]
  ) as any[]
  if (!userRows[0]) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  await db.execute('DELETE FROM staff_module_permissions WHERE user_id = ?', [params.userId])
  return NextResponse.json({ success: true })
}
