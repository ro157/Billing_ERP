import db from '@/lib/db'

let invoiceSchemaReady = false
let ensurePromise: Promise<void> | null = null

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

async function runEnsureInvoiceSchema(): Promise<void> {
  if (!(await hasColumn('invoices', 'party_details'))) {
    try {
      await db.execute(
        'ALTER TABLE invoices ADD COLUMN party_details JSON NULL AFTER terms'
      )
    } catch (e: unknown) {
      if (!isDuplicateColumnError(e)) throw e
    }
  }

  invoiceSchemaReady = true
}

export async function ensureInvoiceSchema(): Promise<void> {
  if (invoiceSchemaReady) return
  if (!ensurePromise) {
    ensurePromise = runEnsureInvoiceSchema().finally(() => {
      ensurePromise = null
    })
  }
  return ensurePromise
}
