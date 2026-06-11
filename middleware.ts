import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { moduleFromPath } from '@/lib/permissions'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname
    const isAdmin = token?.role === 'ADMIN'

    if (path.startsWith('/profile')) {
      return NextResponse.next()
    }

    const adminOnlyPaths = ['/staff', '/roles', '/settings']
    if (adminOnlyPaths.some((p) => path.startsWith(p))) {
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      return NextResponse.next()
    }

    if (!isAdmin) {
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
              'gst-reports': '/gst-reports',
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
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
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
    '/gst-reports/:path*',
    '/staff/:path*',
    '/roles/:path*',
    '/settings/:path*',
    '/profile/:path*',
  ],
}
