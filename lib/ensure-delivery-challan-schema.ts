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

export async function ensureDeliveryChallanSchema(): Promise<void> {
  if (schemaReady) return

  if (!(await hasColumn('delivery_challans', 'party_details'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN party_details JSON NULL AFTER notes'
    )
  }
  if (!(await hasColumn('delivery_challans', 'driver_name'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN driver_name VARCHAR(100) NULL AFTER vehicle_no'
    )
  }
  if (!(await hasColumn('delivery_challans', 'destination'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN destination VARCHAR(255) NULL AFTER driver_name'
    )
  }
  if (!(await hasColumn('delivery_challans', 'e_way_bill_no'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN e_way_bill_no VARCHAR(50) NULL AFTER destination'
    )
  }
  if (!(await hasColumn('delivery_challans', 'completion_date'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN completion_date DATETIME NULL AFTER date'
    )
  }
  if (!(await hasColumn('delivery_challans', 'terms'))) {
    await addColumn(
      'ALTER TABLE delivery_challans ADD COLUMN terms TEXT NULL AFTER party_details'
    )
  }

  schemaReady = true
}
