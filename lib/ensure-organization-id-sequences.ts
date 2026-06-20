import type mysql from 'mysql2/promise'
import db from '@/lib/db'
import { parseOrganizationSerial } from '@/lib/org-id'

let schemaReady = false

async function runAlter(sql: string): Promise<void> {
  try {
    await db.execute(sql)
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    if (
      err?.code === 'ER_TABLE_EXISTS_ERROR' ||
      err?.errno === 1050 ||
      /already exists/i.test(msg)
    ) {
      return
    }
    throw e
  }
}

/** Tracks highest issued serial per month so deleted org IDs are never reused. */
export async function syncOrganizationIdSequences(
  conn: mysql.Pool | mysql.PoolConnection
): Promise<void> {
  const [rows] = (await conn.execute(
    `SELECT id FROM organizations
     WHERE CHAR_LENGTH(id) > 6 AND id REGEXP '^[0-9]+$'`
  )) as [{ id: string }[], unknown]

  const monthMax = new Map<string, number>()
  for (const row of rows) {
    const prefix = row.id.slice(0, 6)
    const serial = parseOrganizationSerial(row.id, prefix) ?? 0
    const current = monthMax.get(prefix) ?? 0
    if (serial > current) monthMax.set(prefix, serial)
  }

  for (const [prefix, maxSerial] of Array.from(monthMax.entries())) {
    await conn.execute(
      `INSERT INTO organization_id_sequences (month_prefix, last_serial)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_serial = GREATEST(last_serial, VALUES(last_serial))`,
      [prefix, maxSerial]
    )
  }
}

export async function ensureOrganizationIdSequencesSchema(): Promise<void> {
  if (schemaReady) return

  await runAlter(`
    CREATE TABLE IF NOT EXISTS organization_id_sequences (
      month_prefix VARCHAR(6) NOT NULL PRIMARY KEY,
      last_serial INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await syncOrganizationIdSequences(db)
  schemaReady = true
}
