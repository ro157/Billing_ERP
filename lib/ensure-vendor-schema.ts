import db from '@/lib/db'

let contactPersonColumnReady = false

export async function ensureVendorContactPersonColumn(): Promise<void> {
  if (contactPersonColumnReady) return
  try {
    await db.execute(
      'ALTER TABLE vendors ADD COLUMN contact_person VARCHAR(255) NULL AFTER name'
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
  contactPersonColumnReady = true
}
