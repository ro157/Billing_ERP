import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const [users] = await db.execute(
          'SELECT * FROM users WHERE email = ? LIMIT 1',
          [credentials.email]
        ) as any[]
        const user = users[0]

        if (!user) {
          throw new Error('Invalid credentials')
        }

        if (user.status === 'INACTIVE') {
          throw new Error('Your account has been deactivated. Contact admin.')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        let permissions: string[] = []

        if (user.role === 'ADMIN') {
          permissions = ['*']
        } else {
          try {
            const { ensureStaffPermissionsSchema } = await import('@/lib/ensure-staff-permissions-schema')
            await ensureStaffPermissionsSchema()
          } catch {
            // Table may not exist yet on older installs
          }

          const [modRows] = await db.execute(
            'SELECT module FROM staff_module_permissions WHERE user_id = ?',
            [user.id]
          ) as any[]

          if (modRows.length > 0) {
            const { expandModulesToPermissions } = await import('@/lib/permissions')
            permissions = expandModulesToPermissions(modRows.map((r: any) => r.module))
          } else {
            const [permRows] = await db.execute(
              `SELECT p.module, p.action
               FROM staff_roles sr
               JOIN role_permissions rp ON sr.role_id = rp.role_id
               JOIN permissions p ON rp.permission_id = p.id
               WHERE sr.user_id = ?`,
              [user.id]
            ) as any[]

            for (const row of permRows) {
              const key = `${row.module}:${row.action}`
              if (!permissions.includes(key)) permissions.push(key)
            }
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.permissions = token.permissions as string[]
      }
      return session
    },
  },
}
