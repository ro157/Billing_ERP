import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { moduleFromPath } from '@/lib/permissions'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith('/superadmin')) {
      if (!token?.isSuperAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      return NextResponse.next()
    }

    const isOrgAdmin = token?.orgRole === 'OWNER' || token?.orgRole === 'ADMIN'

    if (path.startsWith('/profile')) {
      return NextResponse.next()
    }

    const adminOnlyPaths = ['/staff', '/roles', '/settings']
    if (adminOnlyPaths.some((p) => path.startsWith(p))) {
      if (!isOrgAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      return NextResponse.next()
    }

    if (!isOrgAdmin) {
      const module = moduleFromPath(path)
      if (module) {
        const permissions = (token?.permissions as string[]) || []
        const hasAccess =
          permissions.includes('*') || permissions.includes(`${module}:view`)
        if (!hasAccess) {
          const fallback = permissions.find((p) => p.endsWith(':view'))
          if (fallback) {
            const allowedModule = fallback.split(':')[0]
            const redirectMap: Record<string, string> = {
              dashboard: '/dashboard',
              inventory: '/inventory',
              billing: '/billing',
              purchases: '/purchases',
              customers: '/customers',
              vendors: '/vendors',
              quotations: '/quotations',
              'purchase-orders': '/purchase-orders',
              'delivery-challans': '/delivery-challans',
              'returnable-challans': '/returnable-challans',
              reports: '/reports',
            }
            const redirectTo = redirectMap[allowedModule] || '/login'
            return NextResponse.redirect(new URL(redirectTo, req.url))
          }
          return NextResponse.redirect(new URL('/login', req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/superadmin')) {
          return Boolean(token?.isSuperAdmin)
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/superadmin/:path*',
    '/dashboard/:path*',
    '/inventory/:path*',
    '/billing/:path*',
    '/purchases/:path*',
    '/customers/:path*',
    '/vendors/:path*',
    '/quotations/:path*',
    '/purchase-orders/:path*',
    '/delivery-challans/:path*',
    '/returnable-challans/:path*',
    '/reports/:path*',
    '/staff/:path*',
    '/roles/:path*',
    '/settings/:path*',
    '/profile/:path*',
  ],
}
