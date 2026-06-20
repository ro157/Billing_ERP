import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureSuperAdminSchema } from '@/lib/ensure-superadmin-schema'
import { loadOrgPermissions, loadUserOrganizations } from '@/lib/tenant'

const emptyOrgContext = {
  organizationId: '',
  organizationName: '',
  organizationSlug: '',
  orgRole: '',
  permissions: [] as string[],
  organizations: [] as { id: string; name: string; slug: string; role: string }[],
}

async function resolveOrgContext(userId: string, preferredOrgId?: string) {
  await ensureOrganizationSchema()
  const memberships = await loadUserOrganizations(db, userId)
  if (memberships.length === 0) {
    throw new Error('No organization access')
  }

  const active =
    (preferredOrgId && memberships.find((m) => m.organizationId === preferredOrgId)) ||
    memberships[0]

  const permissions = await loadOrgPermissions(
    db,
    userId,
    active.organizationId,
    active.orgRole
  )

  return {
    organizationId: active.organizationId,
    organizationName: active.organizationName,
    organizationSlug: active.organizationSlug,
    orgRole: active.orgRole,
    permissions,
    organizations: memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      slug: m.organizationSlug,
      role: m.orgRole,
    })),
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        organizationId: { label: 'Organization', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        await ensureSuperAdminSchema()

        const [users] = (await db.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [
          credentials.email,
        ])) as [Record<string, string | number>[], unknown]
        const user = users[0]

        if (!user) {
          throw new Error('Invalid credentials')
        }

        if (user.status === 'INACTIVE') {
          throw new Error('Your account has been deactivated. Contact admin.')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, String(user.password))
        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        const isSuperAdmin = Boolean(Number(user.is_super_admin))

        if (!isSuperAdmin) {
          const [pendingRows] = (await db.execute(
            `SELECT o.name FROM organization_members om
             JOIN organizations o ON o.id = om.organization_id
             WHERE om.user_id = ? AND o.status = 'PENDING'
             LIMIT 1`,
            [user.id]
          )) as [{ name: string }[], unknown]

          if (pendingRows[0]) {
            throw new Error(
              'Your organisation is pending approval. Please wait for Super Admin to approve your registration.'
            )
          }
        }

        let orgContext = { ...emptyOrgContext }
        if (isSuperAdmin) {
          try {
            orgContext = await resolveOrgContext(
              String(user.id),
              credentials.organizationId || undefined
            )
          } catch {
            // Super admin may operate without org membership
          }
        } else {
          try {
            orgContext = await resolveOrgContext(
              String(user.id),
              credentials.organizationId || undefined
            )
          } catch {
            throw new Error('No organization access. Contact your administrator.')
          }
        }

        return {
          id: String(user.id),
          name: String(user.name),
          email: String(user.email),
          role: String(user.role),
          isSuperAdmin,
          ...orgContext,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.isSuperAdmin = user.isSuperAdmin
        token.permissions = user.permissions
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.organizationSlug = user.organizationSlug
        token.orgRole = user.orgRole
        token.organizations = user.organizations
      }

      if (trigger === 'update' && session?.organizationId && token.id) {
        const orgContext = await resolveOrgContext(
          token.id as string,
          session.organizationId as string
        )
        token.organizationId = orgContext.organizationId
        token.organizationName = orgContext.organizationName
        token.organizationSlug = orgContext.organizationSlug
        token.orgRole = orgContext.orgRole
        token.permissions = orgContext.permissions
        token.organizations = orgContext.organizations
      }

      if (token.id && !token.organizationId) {
        try {
          const orgContext = await resolveOrgContext(token.id as string)
          token.organizationId = orgContext.organizationId
          token.organizationName = orgContext.organizationName
          token.organizationSlug = orgContext.organizationSlug
          token.orgRole = orgContext.orgRole
          token.permissions = orgContext.permissions
          token.organizations = orgContext.organizations
        } catch {
          // No org membership
        }
      }

      if (token.id && token.isSuperAdmin === undefined) {
        token.isSuperAdmin = await (async () => {
          await ensureSuperAdminSchema()
          const [rows] = (await db.execute(
            'SELECT is_super_admin FROM users WHERE id = ? LIMIT 1',
            [token.id]
          )) as [{ is_super_admin: number }[], unknown]
          return Boolean(Number(rows[0]?.is_super_admin))
        })()
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin)
        session.user.permissions = (token.permissions as string[]) || []
        session.user.organizationId = (token.organizationId as string) || ''
        session.user.organizationName = (token.organizationName as string) || ''
        session.user.organizationSlug = (token.organizationSlug as string) || ''
        session.user.orgRole = (token.orgRole as string) || ''
        session.user.organizations =
          (token.organizations as {
            id: string
            name: string
            slug: string
            role: string
          }[]) || []
      }
      return session
    },
  },
}
