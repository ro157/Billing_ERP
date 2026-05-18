import db from '@/lib/db'

let discountColumnReady = false

/**
 * Older databases created before `discount` was added to `products` will 500 on INSERT/UPDATE.
 * Ensures the column exists (idempotent; ignores duplicate-column errors).
 */
export async function ensureProductsDiscountColumn(): Promise<void> {
  if (discountColumnReady) return
  try {
    await db.execute(
      'ALTER TABLE products ADD COLUMN discount DECIMAL(5,2) NULL DEFAULT NULL'
    )
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    const isDuplicate =
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.errno === 1060 ||
      /duplicate column name/i.test(msg) ||
      /Duplicate column/i.test(msg)
    if (!isDuplicate) throw e
  }
  discountColumnReady = true
}
