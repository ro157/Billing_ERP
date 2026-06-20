import { getServerSession, Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureSuperAdminSchema } from '@/lib/ensure-superadmin-schema'

type AuthResult = {
  error: NextResponse | null
  session: Session | null
  organizationId: string | null
}

async function requireOrganization(): Promise<AuthResult> {
  await ensureOrganizationSchema()
  await ensureSuperAdminSchema()
  const { error, session } = await requireAuth()
  if (error) return { error, session: null, organizationId: null }

  const organizationId = session!.user.organizationId
  if (!organizationId) {
    return {
      error: NextResponse.json({ error: 'No organization context' }, { status: 403 }),
      session: null,
      organizationId: null,
    }
  }

  const [orgRows] = (await db.execute(
    'SELECT status FROM organizations WHERE id = ? LIMIT 1',
    [organizationId]
  )) as [{ status: string }[], unknown]

  if (orgRows[0]?.status === 'PENDING') {
    return {
      error: NextResponse.json(
        { error: 'Organisation pending approval. Contact Super Admin.' },
        { status: 403 }
      ),
      session: null,
      organizationId: null,
    }
  }

  if (orgRows[0]?.status === 'SUSPENDED') {
    return {
      error: NextResponse.json(
        { error: 'Organization suspended. Contact platform administrator.' },
        { status: 403 }
      ),
      session: null,
      organizationId: null,
    }
  }

  return { error: null, session, organizationId }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  return { error: null, session }
}

export async function requireOrgAdmin(): Promise<AuthResult> {
  const result = await requireOrganization()
  if (result.error) return result

  const orgRole = result.session!.user.orgRole
  if (orgRole !== 'OWNER' && orgRole !== 'ADMIN') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
      organizationId: null,
    }
  }
  return result
}

/** @deprecated Use requireOrgAdmin — kept as alias for existing routes */
export async function requireAdmin(): Promise<AuthResult> {
  return requireOrgAdmin()
}

export async function requirePermission(module: string, action: string): Promise<AuthResult> {
  const result = await requireOrganization()
  if (result.error) return result

  const session = result.session!
  const perms = session.user.permissions || []
  const hasPermission =
    session.user.orgRole === 'OWNER' ||
    session.user.orgRole === 'ADMIN' ||
    perms.includes('*') ||
    perms.includes(`${module}:${action}`)

  if (!hasPermission) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
      organizationId: null,
    }
  }
  return result
}
