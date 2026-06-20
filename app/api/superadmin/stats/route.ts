import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireSuperAdmin } from '@/lib/superadmin-auth'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureOrganizationDetailsSchema } from '@/lib/ensure-organization-details-schema'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await ensureOrganizationSchema()
  await ensureOrganizationDetailsSchema()

  const [[orgStats]] = (await db.execute(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
     FROM organizations`
  )) as [{ total: number; active: number; suspended: number; pending: number }[], unknown]

  const [pendingOrgs] = (await db.execute(
    `SELECT id, name, phone, state, owner_name as ownerName, owner_email as ownerEmail, created_at as createdAt
     FROM organizations
     WHERE status = 'PENDING'
     ORDER BY created_at DESC
     LIMIT 10`
  )) as [Record<string, unknown>[], unknown]

  const [[userStats]] = (await db.execute(
    `SELECT COUNT(DISTINCT user_id) as total FROM organization_members WHERE status = 'ACTIVE'`
  )) as [{ total: number }[], unknown]

  const [[invoiceStats]] = (await db.execute(
    `SELECT COUNT(*) as total, COALESCE(SUM(total_amount), 0) as revenue FROM invoices`
  )) as [{ total: number; revenue: number }[], unknown]

  return NextResponse.json({
    organizations: {
      total: Number(orgStats.total),
      active: Number(orgStats.active),
      suspended: Number(orgStats.suspended),
      pending: Number(orgStats.pending),
    },
    pendingOrganizations: pendingOrgs.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      phone: row.phone != null ? String(row.phone) : null,
      state: row.state != null ? String(row.state) : null,
      ownerName: row.ownerName != null ? String(row.ownerName) : null,
      ownerEmail: row.ownerEmail != null ? String(row.ownerEmail) : null,
      createdAt: row.createdAt,
    })),
    users: Number(userStats.total),
    invoices: {
      total: Number(invoiceStats.total),
      revenue: Number(invoiceStats.revenue),
    },
  })
}
