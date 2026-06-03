import db from '@/lib/db'

let quotationSchemaReady = false

export async function ensureQuotationSchema(): Promise<void> {
  if (quotationSchemaReady) return
  try {
    await db.execute(
      'ALTER TABLE quotations ADD COLUMN round_off DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tax_amount'
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
      'ALTER TABLE quotation_items MODIFY COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0'
    )
  } catch {
    // column may already be correct
  }
  quotationSchemaReady = true
}
