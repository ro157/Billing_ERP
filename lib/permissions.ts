import { PERMISSION_ACTIONS } from '@/lib/utils'

/** Modules staff can be granted access to (admin-only modules excluded). */
export const STAFF_ASSIGNABLE_MODULES = [
  'dashboard',
  'inventory',
  'billing',
  'purchases',
  'customers',
  'vendors',
  'quotations',
  'purchase-orders',
  'delivery-challans',
  'returnable-challans',
  'reports',
  'gst-reports',
] as const

export type StaffModule = (typeof STAFF_ASSIGNABLE_MODULES)[number]

export const PATH_MODULE_MAP: { prefix: string; module: string }[] = [
  { prefix: '/dashboard', module: 'dashboard' },
  { prefix: '/inventory', module: 'inventory' },
  { prefix: '/billing', module: 'billing' },
  { prefix: '/purchases', module: 'purchases' },
  { prefix: '/customers', module: 'customers' },
  { prefix: '/vendors', module: 'vendors' },
  { prefix: '/quotations', module: 'quotations' },
  { prefix: '/purchase-orders', module: 'purchase-orders' },
  { prefix: '/delivery-challans', module: 'delivery-challans' },
  { prefix: '/returnable-challans', module: 'returnable-challans' },
  { prefix: '/reports', module: 'reports' },
  { prefix: '/gst-reports', module: 'gst-reports' },
]

export function moduleFromPath(path: string): string | null {
  for (const { prefix, module } of PATH_MODULE_MAP) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return module
  }
  return null
}

export function expandModulesToPermissions(modules: string[]): string[] {
  const permissions: string[] = []
  for (const mod of modules) {
    for (const action of PERMISSION_ACTIONS) {
      const key = `${mod}:${action}`
      if (!permissions.includes(key)) permissions.push(key)
    }
  }
  return permissions
}

export function formatModuleLabel(module: string): string {
  return module.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function hasModuleAccess(
  permissions: string[],
  module: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  return permissions.includes(`${module}:view`)
}
