import db from '@/lib/db'

let schemaReady = false

async function hasColumn(table: string, column: string): Promise<boolean> {
  const [rows] = (await db.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )) as [{ cnt: number }[], unknown]
  return Number(rows[0]?.cnt) > 0
}

function isDuplicateColumnError(e: unknown): boolean {
  const err = e as { code?: string; errno?: number; message?: string }
  const msg = String(err?.message ?? '')
  return (
    err?.code === 'ER_DUP_FIELDNAME' ||
    err?.errno === 1060 ||
    /duplicate column name/i.test(msg)
  )
}

async function addColumn(sql: string): Promise<void> {
  try {
    await db.execute(sql)
  } catch (e: unknown) {
    if (!isDuplicateColumnError(e)) throw e
  }
}

export async function ensureReturnableChallanSchema(): Promise<void> {
  if (schemaReady) return

  if (!(await hasColumn('returnable_challans', 'party_details'))) {
    await addColumn(
      'ALTER TABLE returnable_challans ADD COLUMN party_details JSON NULL AFTER notes'
    )
  }
  if (!(await hasColumn('returnable_challans', 'terms'))) {
    await addColumn(
      'ALTER TABLE returnable_challans ADD COLUMN terms TEXT NULL AFTER party_details'
    )
  }
  if (!(await hasColumn('returnable_challans', 'include_pricing'))) {
    await addColumn(
      'ALTER TABLE returnable_challans ADD COLUMN include_pricing TINYINT(1) NOT NULL DEFAULT 0 AFTER terms'
    )
  }
  if (!(await hasColumn('returnable_challan_items', 'discount'))) {
    await addColumn(
      'ALTER TABLE returnable_challan_items ADD COLUMN discount DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER rate'
    )
  }

  schemaReady = true
}
