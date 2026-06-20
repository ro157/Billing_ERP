import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import db from '@/lib/db'

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  await ensureOrganizationSchema()
  const { organizationId } = await req.json()

  if (!organizationId || typeof organizationId !== 'string') {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const [rows] = (await db.execute(
    `SELECT om.organization_id, o.name, o.slug, om.role
     FROM organization_members om
     JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = ? AND om.organization_id = ? AND om.status = 'ACTIVE' AND o.status = 'ACTIVE'
     LIMIT 1`,
    [session!.user.id, organizationId]
  )) as [{ organization_id: string; name: string; slug: string; role: string }[], unknown]

  if (!rows[0]) {
    return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 })
  }

  return NextResponse.json({
    organizationId: rows[0].organization_id,
    organizationName: rows[0].name,
    organizationSlug: rows[0].slug,
    orgRole: rows[0].role,
  })
}
