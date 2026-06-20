import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { staffPermissionSchema } from '@/lib/validations'
import { ensureStaffPermissionsSchema } from '@/lib/ensure-staff-permissions-schema'
import { STAFF_ASSIGNABLE_MODULES } from '@/lib/permissions'
import { randomUUID } from 'crypto'

async function listStaffWithPermissions(organizationId: string) {
  const [users] = await db.execute(
    `SELECT u.id, u.name, u.email, u.role, u.status
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ? AND om.status = 'ACTIVE' AND u.role = 'STAFF'
     ORDER BY u.name ASC`,
    [organizationId]
  ) as any[]

  for (const user of users as any[]) {
    const [mods] = await db.execute(
      'SELECT module FROM staff_module_permissions WHERE user_id = ? AND organization_id = ? ORDER BY module ASC',
      [user.id, organizationId]
    ) as any[]
    user.modules = mods.map((m: any) => m.module)
    user.moduleCount = user.modules.length
  }

  return users
}

async function isOrgStaff(userId: string, organizationId: string) {
  const [rows] = await db.execute(
    `SELECT u.id FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ? AND om.user_id = ? AND om.status = 'ACTIVE' AND u.role = 'STAFF'`,
    [organizationId, userId]
  ) as any[]
  return !!rows[0]
}

export async function GET() {
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const staff = await listStaffWithPermissions(organizationId!)
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  try {
    await ensureStaffPermissionsSchema()
    const body = await req.json()
    const data = staffPermissionSchema.parse(body)

    if (!(await isOrgStaff(data.userId, organizationId!))) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const validModules = data.modules.filter((m) =>
      (STAFF_ASSIGNABLE_MODULES as readonly string[]).includes(m)
    )

    await db.execute(
      'DELETE FROM staff_module_permissions WHERE user_id = ? AND organization_id = ?',
      [data.userId, organizationId]
    )
    for (const mod of validModules) {
      await db.execute(
        'INSERT INTO staff_module_permissions (id, user_id, organization_id, module) VALUES (?,?,?,?)',
        [randomUUID(), data.userId, organizationId, mod]
      )
    }

    const [mods] = await db.execute(
      'SELECT module FROM staff_module_permissions WHERE user_id = ? AND organization_id = ? ORDER BY module ASC',
      [data.userId, organizationId]
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
