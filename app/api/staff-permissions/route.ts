import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { staffPermissionSchema } from '@/lib/validations'
import { ensureStaffPermissionsSchema } from '@/lib/ensure-staff-permissions-schema'
import { STAFF_ASSIGNABLE_MODULES } from '@/lib/permissions'
import { randomUUID } from 'crypto'

async function listStaffWithPermissions() {
  const [users] = await db.execute(
    `SELECT id, name, email, role, status FROM users WHERE role = 'STAFF' ORDER BY name ASC`
  ) as any[]

  for (const user of users as any[]) {
    const [mods] = await db.execute(
      'SELECT module FROM staff_module_permissions WHERE user_id = ? ORDER BY module ASC',
      [user.id]
    ) as any[]
    user.modules = mods.map((m: any) => m.module)
    user.moduleCount = user.modules.length
  }

  return users
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const staff = await listStaffWithPermissions()
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    await ensureStaffPermissionsSchema()
    const body = await req.json()
    const data = staffPermissionSchema.parse(body)

    const [userRows] = await db.execute(
      "SELECT id, role FROM users WHERE id = ? AND role = 'STAFF'",
      [data.userId]
    ) as any[]
    if (!userRows[0]) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const validModules = data.modules.filter((m) =>
      (STAFF_ASSIGNABLE_MODULES as readonly string[]).includes(m)
    )

    await db.execute('DELETE FROM staff_module_permissions WHERE user_id = ?', [data.userId])
    for (const mod of validModules) {
      await db.execute(
        'INSERT INTO staff_module_permissions (id, user_id, module) VALUES (?,?,?)',
        [randomUUID(), data.userId, mod]
      )
    }

    const [mods] = await db.execute(
      'SELECT module FROM staff_module_permissions WHERE user_id = ? ORDER BY module ASC',
      [data.userId]
    ) as any[]

    return NextResponse.json(
      {
        userId: data.userId,
        modules: mods.map((m: any) => m.module),
        moduleCount: mods.length,
      },
      { status: 201 }
    )
  } catch (err: any) {
    if (err.name === 'ZodError') {
      const msg = err.errors?.map((e: { message?: string }) => e.message).join(', ')
      return NextResponse.json({ error: msg || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
