import { getServerSession, Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { ensureSuperAdminSchema, isUserSuperAdmin } from '@/lib/ensure-superadmin-schema'

type SuperAdminResult = {
  error: NextResponse | null
  session: Session | null
}

export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  await ensureSuperAdminSchema()
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }

  const isSuperAdmin =
    session.user.isSuperAdmin || (await isUserSuperAdmin(session.user.id))

  if (!isSuperAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null }
  }

  return { error: null, session }
}
