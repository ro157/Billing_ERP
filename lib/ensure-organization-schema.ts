import db from '@/lib/db'
import { randomUUID } from 'crypto'
import {
  generateOrganizationId,
  migrateLegacyOrganizationIds,
} from '@/lib/org-id'
import { ensureOrganizationDetailsSchema } from '@/lib/ensure-organization-details-schema'
import { ensureOrganizationIdSequencesSchema } from '@/lib/ensure-organization-id-sequences'
import { ensureBusinessSettingsUniquePerOrg } from '@/lib/ensure-business-settings-schema'
import { generateUniqueOrgSlug } from '@/lib/tenant'

let schemaReady = false

async function getAnyOrganizationId(): Promise<string | null> {
  const [rows] = (await db.execute(
    'SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1'
  )) as [{ id: string }[], unknown]
  return rows[0]?.id ?? null
}

/** One-time bootstrap when upgrading a legacy single-tenant DB with no organizations yet. */
async function bootstrapLegacyOrganizationIfNeeded(): Promise<string | null> {
  const [countRows] = (await db.execute(
    'SELECT COUNT(*) as cnt FROM organizations'
  )) as [{ cnt: number }[], unknown]
  if (Number(countRows[0]?.cnt) > 0) return getAnyOrganizationId()

  const [settingsRows] = (await db.execute(
    'SELECT company_name FROM business_settings WHERE company_name IS NOT NULL AND company_name != "" LIMIT 1'
  )) as [{ company_name: string }[], unknown]

  const companyName = settingsRows[0]?.company_name?.trim() || 'My Organization'
  const orgId = await generateOrganizationId(db)
  const slug = await generateUniqueOrgSlug(db, companyName)

  await db.execute(
    `INSERT INTO organizations (id, name, slug, status, plan) VALUES (?, ?, ?, 'ACTIVE', 'free')`,
    [orgId, companyName, slug]
  )

  return orgId
}

async function runAlter(sql: string): Promise<void> {
  try {
    await db.execute(sql)
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    const isDuplicate =
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.errno === 1060 ||
      /duplicate column name/i.test(msg)
    const isExists =
      err?.code === 'ER_TABLE_EXISTS_ERROR' ||
      err?.errno === 1050 ||
      /already exists/i.test(msg)
    if (!isDuplicate && !isExists) throw e
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = (await db.execute(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )) as [{ cnt: number }[], unknown]
  return Number(rows[0]?.cnt) > 0
}

async function addOrgColumn(table: string, fallbackOrgId: string): Promise<void> {
  const hasCol = await columnExists(table, 'organization_id')
  if (hasCol) return
  await runAlter(
    `ALTER TABLE ${table} ADD COLUMN organization_id VARCHAR(36) NULL AFTER id`
  )
  await db.execute(`UPDATE ${table} SET organization_id = ? WHERE organization_id IS NULL`, [
    fallbackOrgId,
  ])
  await runAlter(
    `ALTER TABLE ${table} MODIFY COLUMN organization_id VARCHAR(36) NOT NULL`
  )
  await runAlter(
    `ALTER TABLE ${table} ADD INDEX idx_${table}_organization_id (organization_id)`
  )
}

const TENANT_TABLES = [
  'business_settings',
  'categories',
  'brands',
  'products',
  'customers',
  'vendors',
  'quotations',
  'invoices',
  'purchase_orders',
  'purchases',
  'delivery_challans',
  'returnable_challans',
  'ledger_entries',
  'roles',
] as const

export async function ensureOrganizationSchema(): Promise<void> {
  if (schemaReady) return

  await runAlter(`
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      plan VARCHAR(50) NOT NULL DEFAULT 'free',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await runAlter(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'STAFF',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_org_user (organization_id, user_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const fallbackOrgId = await bootstrapLegacyOrganizationIfNeeded()

  for (const table of TENANT_TABLES) {
    const hasCol = await columnExists(table, 'organization_id')
    if (hasCol || !fallbackOrgId) continue
    await addOrgColumn(table, fallbackOrgId)
  }

  const hasStaffModOrg = await columnExists('staff_module_permissions', 'organization_id')
  if (!hasStaffModOrg && fallbackOrgId) {
    await runAlter(
      `ALTER TABLE staff_module_permissions ADD COLUMN organization_id VARCHAR(36) NULL AFTER user_id`
    )
    await db.execute(
      `UPDATE staff_module_permissions SET organization_id = ? WHERE organization_id IS NULL`,
      [fallbackOrgId]
    )
    await runAlter(
      `ALTER TABLE staff_module_permissions MODIFY COLUMN organization_id VARCHAR(36) NOT NULL`
    )
    await runAlter(
      `ALTER TABLE staff_module_permissions DROP INDEX uq_user_module`
    ).catch(() => {})
    await runAlter(
      `ALTER TABLE staff_module_permissions ADD UNIQUE KEY uq_org_user_module (organization_id, user_id, module)`
    ).catch(() => {})
  }

  const [memberCount] = (await db.execute(
    'SELECT COUNT(*) as cnt FROM organization_members'
  )) as [{ cnt: number }[], unknown]

  if (Number(memberCount[0]?.cnt) === 0) {
    const targetOrgId = (await getAnyOrganizationId()) ?? fallbackOrgId
    if (!targetOrgId) {
      schemaReady = true
      return
    }

    const [users] = (await db.execute('SELECT id, role FROM users')) as [
      { id: string; role: string }[],
      unknown,
    ]
    for (const user of users) {
      const memberRole = user.role === 'ADMIN' ? 'OWNER' : 'STAFF'
      await db.execute(
        `INSERT IGNORE INTO organization_members (id, organization_id, user_id, role, status, is_default)
         VALUES (?, ?, ?, ?, 'ACTIVE', 1)`,
        [randomUUID(), targetOrgId, user.id, memberRole]
      )
    }
  }

  await migrateLegacyOrganizationIds(db)
  await ensureOrganizationIdSequencesSchema()
  await ensureBusinessSettingsUniquePerOrg()
  await ensureOrganizationDetailsSchema()

  schemaReady = true
}
