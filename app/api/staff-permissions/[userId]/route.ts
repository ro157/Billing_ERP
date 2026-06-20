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

async function getStaffPermission(userId: string, organizationId: string) {
  const [users] = await db.execute(
    `SELECT u.id, u.name, u.email, u.role, u.status
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ? AND om.user_id = ? AND om.status = 'ACTIVE' AND u.role = 'STAFF'`,
    [organizationId, userId]
  ) as any[]
  if (!users[0]) return null

  const [mods] = await db.execute(
    'SELECT module FROM staff_module_permissions WHERE user_id = ? AND organization_id = ? ORDER BY module ASC',
    [userId, organizationId]
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
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const record = await getStaffPermission(params.userId, organizationId!)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  try {
    await ensureStaffPermissionsSchema()
    const body = await req.json()
    const data = updateSchema.parse(body)

    const record = await getStaffPermission(params.userId, organizationId!)
    if (!record) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const validModules = data.modules.filter((m) =>
      (STAFF_ASSIGNABLE_MODULES as readonly string[]).includes(m)
    )

    await db.execute(
      'DELETE FROM staff_module_permissions WHERE user_id = ? AND organization_id = ?',
      [params.userId, organizationId]
    )
    for (const mod of validModules) {
      await db.execute(
        'INSERT INTO staff_module_permissions (id, user_id, organization_id, module) VALUES (?,?,?,?)',
        [randomUUID(), params.userId, organizationId, mod]
      )
    }

    const updated = await getStaffPermission(params.userId, organizationId!)
    return NextResponse.json(updated)
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
  const { error, organizationId } = await requireAdmin()
  if (error) return error

  await ensureStaffPermissionsSchema()
  const record = await getStaffPermission(params.userId, organizationId!)
  if (!record) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  await db.execute(
    'DELETE FROM staff_module_permissions WHERE user_id = ? AND organization_id = ?',
    [params.userId, organizationId]
  )
  return NextResponse.json({ success: true })
}
