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

  schemaReady = true
}
