import db from '@/lib/db'

let schemaReady = false

async function runAlter(sql: string): Promise<void> {
  try {
    await db.execute(sql)
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    const msg = String(err?.message ?? '')
    if (
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.errno === 1060 ||
      /duplicate column name/i.test(msg)
    ) {
      return
    }
    throw e
  }
}

const ORG_DETAIL_COLUMNS: { sql: string; backfill?: string }[] = [
  { sql: 'ALTER TABLE organizations ADD COLUMN phone VARCHAR(20) NULL AFTER plan' },
  { sql: 'ALTER TABLE organizations ADD COLUMN address TEXT NULL AFTER phone' },
  { sql: 'ALTER TABLE organizations ADD COLUMN gstin VARCHAR(20) NULL AFTER address' },
  { sql: 'ALTER TABLE organizations ADD COLUMN state VARCHAR(100) NULL AFTER gstin' },
  { sql: 'ALTER TABLE organizations ADD COLUMN pincode VARCHAR(10) NULL AFTER state' },
  { sql: 'ALTER TABLE organizations ADD COLUMN owner_name VARCHAR(100) NULL AFTER pincode' },
  { sql: 'ALTER TABLE organizations ADD COLUMN owner_email VARCHAR(255) NULL AFTER owner_name' },
]

export async function ensureOrganizationDetailsSchema(): Promise<void> {
  if (schemaReady) return

  for (const col of ORG_DETAIL_COLUMNS) {
    await runAlter(col.sql)
  }

  // Backfill org details from business_settings where missing
  await db.execute(`
    UPDATE organizations o
    JOIN business_settings bs ON bs.organization_id = o.id
    SET
      o.phone = COALESCE(o.phone, bs.phone),
      o.address = COALESCE(o.address, bs.address),
      o.gstin = COALESCE(o.gstin, bs.gstin),
      o.state = COALESCE(o.state, bs.state),
      o.pincode = COALESCE(o.pincode, bs.pincode),
      o.owner_email = COALESCE(o.owner_email, bs.email)
    WHERE o.phone IS NULL OR o.address IS NULL OR o.owner_email IS NULL
  `).catch(() => {})

  schemaReady = true
}
