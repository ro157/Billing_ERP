import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    role: string
    isSuperAdmin: boolean
    permissions: string[]
    organizationId: string
    organizationName: string
    organizationSlug: string
    orgRole: string
    organizations: { id: string; name: string; slug: string; role: string }[]
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      isSuperAdmin: boolean
      permissions: string[]
      organizationId: string
      organizationName: string
      organizationSlug: string
      orgRole: string
      organizations: { id: string; name: string; slug: string; role: string }[]
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    isSuperAdmin?: boolean
    permissions: string[]
    organizationId: string
    organizationName: string
    organizationSlug: string
    orgRole: string
    organizations: { id: string; name: string; slug: string; role: string }[]
  }
}
