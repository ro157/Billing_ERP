import db from '@/lib/db'

let ensured = false

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  ) as any[]
  return Number(rows[0]?.cnt) > 0
}

export async function ensureStaffPermissionsSchema(): Promise<void> {
  if (ensured) return

  if (!(await tableExists('staff_module_permissions'))) {
    await db.execute(`
      CREATE TABLE staff_module_permissions (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        module VARCHAR(100) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_module (user_id, module),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  ensured = true
}
