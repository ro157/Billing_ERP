export const LIGHT_ONLY_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-otp',
] as const

/** Auth and public landing pages always use light mode. */
export function isLightOnlyRoute(pathname: string): boolean {
  return pathname === '/' || (LIGHT_ONLY_ROUTES as readonly string[]).includes(pathname)
}
