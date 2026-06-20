import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireSuperAdmin } from '@/lib/superadmin-auth'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureOrganizationDetailsSchema } from '@/lib/ensure-organization-details-schema'

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await ensureOrganizationSchema()
  await ensureOrganizationDetailsSchema()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''

  const conditions: string[] = []
  const params: string[] = []

  if (search) {
    conditions.push('(o.name LIKE ? OR o.slug LIKE ? OR o.owner_email LIKE ? OR o.phone LIKE ?)')
    const s = `%${search}%`
    params.push(s, s, s, s)
  }
  if (status && status !== 'all') {
    conditions.push('o.status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows] = (await db.execute(
    `SELECT
       o.id,
       o.name,
       o.slug,
       o.status,
       o.plan,
       o.phone,
       o.address,
       o.gstin,
       o.state,
       o.pincode,
       o.owner_name as ownerName,
       o.owner_email as ownerEmail,
       o.created_at as createdAt,
       o.updated_at as updatedAt,
       (SELECT COUNT(*) FROM organization_members om
        WHERE om.organization_id = o.id AND om.status = 'ACTIVE') as memberCount,
       (SELECT COUNT(*) FROM invoices i WHERE i.organization_id = o.id) as invoiceCount,
       (SELECT COUNT(*) FROM products p WHERE p.organization_id = o.id) as productCount,
       o.name as companyName,
       o.gstin
     FROM organizations o
     ${where}
     ORDER BY o.created_at DESC`,
    params
  )) as [Record<string, unknown>[], unknown]

  const organizations = rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    status: String(row.status ?? 'ACTIVE'),
    plan: String(row.plan ?? 'free'),
    phone: row.phone != null ? String(row.phone) : null,
    address: row.address != null ? String(row.address) : null,
    state: row.state != null ? String(row.state) : null,
    pincode: row.pincode != null ? String(row.pincode) : null,
    ownerName: row.ownerName != null ? String(row.ownerName) : null,
    ownerEmail: row.ownerEmail != null ? String(row.ownerEmail) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberCount: Number(row.memberCount ?? 0),
    invoiceCount: Number(row.invoiceCount ?? 0),
    productCount: Number(row.productCount ?? 0),
    companyName: row.companyName != null ? String(row.companyName) : null,
    gstin: row.gstin != null ? String(row.gstin) : null,
  }))

  return NextResponse.json(organizations)
}
