import db from '@/lib/db'
import { randomUUID } from 'crypto'

const SUPERADMIN_EMAIL = 'nk1428896@gmail.com'
const SUPERADMIN_PASSWORD_HASH =
  '$2a$12$HQFWa9IxeK0wVfxl3dYW1uEca3kdYl2.codDd43lanIBzKhLNPlfm'
const SUPERADMIN_ID = 'superadmin-user-id-000000000001'

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

export async function ensureSuperAdminSchema(): Promise<void> {
  if (schemaReady) return

  await runAlter(
    'ALTER TABLE users ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER role'
  )

  const [existing] = (await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [
    SUPERADMIN_EMAIL,
  ])) as [{ id: string }[], unknown]

  if (existing[0]) {
    await db.execute(
      'UPDATE users SET is_super_admin = 1, password = ?, status = ? WHERE email = ?',
      [SUPERADMIN_PASSWORD_HASH, 'ACTIVE', SUPERADMIN_EMAIL]
    )
  } else {
    await db.execute(
      `INSERT INTO users (id, name, email, password, role, is_super_admin, status)
       VALUES (?, ?, ?, ?, 'ADMIN', 1, 'ACTIVE')`,
      [SUPERADMIN_ID, 'Super Admin', SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD_HASH]
    )
  }

  schemaReady = true
}

export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  await ensureSuperAdminSchema()
  const [rows] = (await db.execute('SELECT is_super_admin FROM users WHERE id = ? LIMIT 1', [
    userId,
  ])) as [{ is_super_admin: number }[], unknown]
  return Boolean(Number(rows[0]?.is_super_admin))
}

export { SUPERADMIN_EMAIL }
