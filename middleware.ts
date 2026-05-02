import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Admin-only routes
    const adminOnlyPaths = ['/staff', '/roles', '/settings']
    if (adminOnlyPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
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
  ],
}
