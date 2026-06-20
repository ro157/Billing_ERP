import type mysql from 'mysql2/promise'

/** Append organization_id filter to SQL query builders. */
export function appendOrgFilter(
  conditions: string[],
  params: unknown[],
  organizationId: string,
  alias?: string
): void {
  const prefix = alias ? `${alias}.` : ''
  conditions.push(`${prefix}organization_id = ?`)
  params.push(organizationId)
}

export function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function generateUniqueOrgSlug(
  dbConn: mysql.Pool | mysql.PoolConnection,
  baseName: string
): Promise<string> {
  let slug = slugifyOrganizationName(baseName) || 'organization'
  let attempt = 0
  while (attempt < 100) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const [rows] = (await dbConn.execute('SELECT id FROM organizations WHERE slug = ? LIMIT 1', [
      candidate,
    ])) as [{ id: string }[], unknown]
    if (!rows[0]) return candidate
    attempt++
  }
  return `${slug}-${Date.now()}`
}

export type OrgMembership = {
  organizationId: string
  organizationName: string
  organizationSlug: string
  orgRole: 'OWNER' | 'ADMIN' | 'STAFF'
}

export async function loadUserOrganizations(
  dbConn: mysql.Pool | mysql.PoolConnection,
  userId: string
): Promise<OrgMembership[]> {
  const [rows] = (await dbConn.execute(
    `SELECT om.organization_id as organizationId, om.role as orgRole,
            o.name as organizationName, o.slug as organizationSlug
     FROM organization_members om
     JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = ? AND om.status = 'ACTIVE' AND o.status = 'ACTIVE'
     ORDER BY om.is_default DESC, om.created_at ASC`,
    [userId]
  )) as [OrgMembership[], unknown]
  return rows
}

export async function loadOrgPermissions(
  dbConn: mysql.Pool | mysql.PoolConnection,
  userId: string,
  organizationId: string,
  orgRole: string
): Promise<string[]> {
  if (orgRole === 'OWNER' || orgRole === 'ADMIN') {
    return ['*']
  }

  try {
    const { ensureStaffPermissionsSchema } = await import('@/lib/ensure-staff-permissions-schema')
    await ensureStaffPermissionsSchema()
  } catch {
    // Table may not exist yet on older installs
  }

  const [modRows] = (await dbConn.execute(
    'SELECT module FROM staff_module_permissions WHERE user_id = ? AND organization_id = ?',
    [userId, organizationId]
  )) as [{ module: string }[], unknown]

  if (modRows.length > 0) {
    const { expandModulesToPermissions } = await import('@/lib/permissions')
    return expandModulesToPermissions(modRows.map((r) => r.module))
  }

  const [permRows] = (await dbConn.execute(
    `SELECT p.module, p.action
     FROM staff_roles sr
     JOIN role_permissions rp ON sr.role_id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     JOIN roles r ON sr.role_id = r.id
     WHERE sr.user_id = ? AND r.organization_id = ?`,
    [userId, organizationId]
  )) as [{ module: string; action: string }[], unknown]

  const permissions: string[] = []
  for (const row of permRows) {
    const key = `${row.module}:${row.action}`
    if (!permissions.includes(key)) permissions.push(key)
  }
  return permissions
}
