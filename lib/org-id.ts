import type mysql from 'mysql2/promise'
import { syncOrganizationIdSequences } from '@/lib/ensure-organization-id-sequences'

/** YYYYMM prefix from a date (e.g. June 2026 → "202606"). */
export function getYearMonthPrefix(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

/** True when id matches YYYYMM + serial (e.g. 2026061, 20260623). */
export function isNumericOrganizationId(id: string): boolean {
  return /^\d{7,}$/.test(id) && id.length >= 7
}

export function parseOrganizationSerial(id: string, prefix: string): number | null {
  if (!id.startsWith(prefix)) return null
  const serialPart = id.slice(prefix.length)
  if (!/^\d+$/.test(serialPart)) return null
  return parseInt(serialPart, 10)
}

/** Next organization id for the given registration month (never reuses deleted ids). */
export async function generateOrganizationId(
  conn: mysql.Pool | mysql.PoolConnection,
  registrationDate: Date = new Date()
): Promise<string> {
  const prefix = getYearMonthPrefix(registrationDate)

  await conn.execute(
    `INSERT INTO organization_id_sequences (month_prefix, last_serial) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE month_prefix = month_prefix`,
    [prefix]
  )

  await conn.execute(
    `UPDATE organization_id_sequences SET last_serial = last_serial + 1 WHERE month_prefix = ?`,
    [prefix]
  )

  const [rows] = (await conn.execute(
    `SELECT last_serial FROM organization_id_sequences WHERE month_prefix = ?`,
    [prefix]
  )) as [{ last_serial: number }[], unknown]

  const serial = Number(rows[0]?.last_serial ?? 1)
  return `${prefix}${serial}`
}

export const ORG_ID_TABLES = [
  'organization_members',
  'staff_module_permissions',
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

/** Reassign legacy UUID org ids to YYYYMM+serial based on created_at. */
export async function migrateLegacyOrganizationIds(
  conn: mysql.Pool | mysql.PoolConnection
): Promise<void> {
  const [allOrgs] = (await conn.execute(
    `SELECT id, created_at FROM organizations ORDER BY created_at ASC`
  )) as [{ id: string; created_at: Date | string }[], unknown]

  const legacyOrgs = allOrgs.filter((org) => !isNumericOrganizationId(org.id))
  if (legacyOrgs.length === 0) return

  const monthCounters = new Map<string, number>()

  for (const org of allOrgs) {
    if (isNumericOrganizationId(org.id)) {
      const prefix = org.id.slice(0, 6)
      const serial = parseOrganizationSerial(org.id, prefix) ?? 0
      const current = monthCounters.get(prefix) ?? 0
      if (serial > current) monthCounters.set(prefix, serial)
    }
  }

  const useTransaction = 'beginTransaction' in conn
  if (useTransaction) {
    await (conn as mysql.PoolConnection).beginTransaction()
  }

  try {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0')

    for (const org of legacyOrgs) {
      const createdAt = org.created_at ? new Date(org.created_at) : new Date()
      const prefix = getYearMonthPrefix(createdAt)
      const nextSerial = (monthCounters.get(prefix) ?? 0) + 1
      monthCounters.set(prefix, nextSerial)
      const newId = `${prefix}${nextSerial}`

      for (const table of ORG_ID_TABLES) {
        try {
          await conn.execute(
            `UPDATE ${table} SET organization_id = ? WHERE organization_id = ?`,
            [newId, org.id]
          )
        } catch {
          // Table may not exist on older installs
        }
      }

      await conn.execute('UPDATE organizations SET id = ? WHERE id = ?', [newId, org.id])
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')
    await syncOrganizationIdSequences(conn)
    if (useTransaction) {
      await (conn as mysql.PoolConnection).commit()
    }
  } catch (err) {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {})
    if (useTransaction) {
      await (conn as mysql.PoolConnection).rollback()
    }
    throw err
  }
}

export async function getDefaultOrganizationId(
  conn: mysql.Pool | mysql.PoolConnection
): Promise<string | null> {
  const [rows] = (await conn.execute(
    'SELECT id FROM organizations WHERE slug = ? LIMIT 1',
    ['default']
  )) as [{ id: string }[], unknown]
  return rows[0]?.id ?? null
}
