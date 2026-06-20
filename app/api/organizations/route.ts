import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { loadUserOrganizations } from '@/lib/tenant'
import db from '@/lib/db'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  await ensureOrganizationSchema()
  const orgs = await loadUserOrganizations(db, session!.user.id)

  return NextResponse.json(
    orgs.map((o) => ({
      id: o.organizationId,
      name: o.organizationName,
      slug: o.organizationSlug,
      role: o.orgRole,
      isActive: o.organizationId === session!.user.organizationId,
    }))
  )
}
