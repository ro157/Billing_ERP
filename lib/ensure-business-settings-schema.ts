import db from '@/lib/db'

let schemaReady = false

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
    const isMissing =
      err?.code === 'ER_BAD_FIELD_ERROR' ||
      err?.errno === 1054 ||
      /unknown column/i.test(msg)
    if (!isDuplicate && !isMissing) throw e
  }
}

export async function ensureBusinessSettingsBankingColumns(): Promise<void> {
  if (schemaReady) return

  // Legacy column names → current API names
  await runAlter(
    'ALTER TABLE business_settings CHANGE COLUMN quot_prefix quotation_prefix VARCHAR(10) NOT NULL DEFAULT \'QT\''
  )
  await runAlter(
    'ALTER TABLE business_settings CHANGE COLUMN po_prefix purchase_order_prefix VARCHAR(10) NOT NULL DEFAULT \'PO\''
  )

  // Add columns if missing (fresh or partial schemas)
  await runAlter(
    'ALTER TABLE business_settings ADD COLUMN quotation_prefix VARCHAR(10) NOT NULL DEFAULT \'QT\' AFTER invoice_prefix'
  )
  await runAlter(
    'ALTER TABLE business_settings ADD COLUMN purchase_order_prefix VARCHAR(10) NOT NULL DEFAULT \'PO\' AFTER quotation_prefix'
  )
  await runAlter(
    'ALTER TABLE business_settings ADD COLUMN bank_micr VARCHAR(9) NULL AFTER bank_branch'
  )
  await runAlter(
    'ALTER TABLE business_settings ADD COLUMN upi_id VARCHAR(100) NULL AFTER bank_micr'
  )
  await runAlter(
    `ALTER TABLE business_settings ADD COLUMN sidebar_color VARCHAR(7) NULL DEFAULT '#0f172a' AFTER logo`
  )

  schemaReady = true
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = (await db.execute(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )) as [{ cnt: number }[], unknown]
  return Number(rows[0]?.cnt) > 0
}

/** One business_settings row per organization — removes duplicates that duplicate list rows. */
export async function ensureBusinessSettingsUniquePerOrg(): Promise<void> {
  const hasOrgCol = await columnExists('business_settings', 'organization_id')
  if (!hasOrgCol) return

  await db.execute(`
    DELETE bs FROM business_settings bs
    INNER JOIN (
      SELECT organization_id, MAX(updated_at) as keep_updated
      FROM business_settings
      WHERE organization_id IS NOT NULL
      GROUP BY organization_id
      HAVING COUNT(*) > 1
    ) dup ON bs.organization_id = dup.organization_id
    WHERE bs.updated_at < dup.keep_updated
  `).catch(() => {})

  await db.execute(`
    DELETE bs FROM business_settings bs
    INNER JOIN (
      SELECT organization_id, MIN(id) as keep_id
      FROM business_settings
      WHERE organization_id IS NOT NULL
      GROUP BY organization_id
      HAVING COUNT(*) > 1
    ) dup ON bs.organization_id = dup.organization_id AND bs.id <> dup.keep_id
  `).catch(() => {})

  try {
    await db.execute(
      'ALTER TABLE business_settings ADD UNIQUE KEY uk_business_settings_org (organization_id)'
    )
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    if (
      err?.code !== 'ER_DUP_KEYNAME' &&
      err?.errno !== 1061 &&
      !/duplicate key name/i.test(msg)
    ) {
      throw e
    }
  }
}
