import db from '@/lib/db'

async function hasColumn(table: string, column: string): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  ) as any[]
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

export async function ensureQuotationSchema(): Promise<void> {
  if (!(await hasColumn('quotations', 'round_off'))) {
    try {
      await db.execute(
        'ALTER TABLE quotations ADD COLUMN round_off DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tax_amount'
      )
    } catch (e: unknown) {
      if (!isDuplicateColumnError(e)) throw e
    }
  }

  if (!(await hasColumn('quotations', 'gst_type'))) {
    try {
      await db.execute(
        "ALTER TABLE quotations ADD COLUMN gst_type VARCHAR(20) NOT NULL DEFAULT 'CGST_SGST' AFTER valid_until"
      )
    } catch (e: unknown) {
      if (!isDuplicateColumnError(e)) throw e
    }
  }

  if (!(await hasColumn('quotations', 'party_details'))) {
    try {
      await db.execute(
        'ALTER TABLE quotations ADD COLUMN party_details JSON NULL AFTER terms'
      )
    } catch (e: unknown) {
      if (!isDuplicateColumnError(e)) throw e
    }
  }

  try {
    await db.execute(
      'ALTER TABLE quotation_items MODIFY COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0'
    )
  } catch {
    // column may already be correct
  }
}
