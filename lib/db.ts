import mysql from 'mysql2/promise'

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool }

const pool =
  globalForDb.mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.mysqlPool = pool
}

export function isDbConnectionError(error: unknown): boolean {
  const err = error as { code?: string; errno?: number }

  return (
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'PROTOCOL_CONNECTION_LOST' ||
    err?.errno === -4078
  )
}

export default pool