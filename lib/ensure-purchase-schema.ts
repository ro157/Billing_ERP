import db from '@/lib/db'

let purchaseSchemaReady = false

export async function ensurePurchaseSchema(): Promise<void> {
  if (purchaseSchemaReady) return
  try {
    await db.execute(
      'ALTER TABLE purchases ADD COLUMN round_off DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tax_amount'
    )
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    const isDuplicate =
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.errno === 1060 ||
      /duplicate column name/i.test(msg)
    if (!isDuplicate) throw e
  }
  try {
    await db.execute(
      'ALTER TABLE purchase_items MODIFY COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0'
    )
  } catch {
    // column may already be correct
  }
  purchaseSchemaReady = true
}

let documentTermsColumnsReady = false

export async function ensureDocumentTermsColumns(): Promise<void> {
  if (documentTermsColumnsReady) return
  for (const table of ['purchase_orders', 'purchases'] as const) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN terms TEXT NULL AFTER notes`)
    } catch (e: unknown) {
      const err = e as { code?: string; errno?: number; message?: string }
      const msg = String(err?.message ?? '')
      const isDuplicate =
        err?.code === 'ER_DUP_FIELDNAME' ||
        err?.errno === 1060 ||
        /duplicate column name/i.test(msg)
      if (!isDuplicate) throw e
    }
  }
  documentTermsColumnsReady = true
}
