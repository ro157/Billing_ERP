import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireSuperAdmin } from '@/lib/superadmin-auth'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureOrganizationDetailsSchema } from '@/lib/ensure-organization-details-schema'
import { z } from 'zod'

const updateOrgSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  status: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional()
  ),
  plan: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['free', 'starter', 'pro', 'enterprise']).optional()
  ),
})

function formatZodError(err: z.ZodError): string {
  return err.errors.map((e) => e.message).join(', ')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await ensureOrganizationDetailsSchema()

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
       bs.company_name as companyName,
       COALESCE(o.gstin, bs.gstin) as gstin,
       bs.email as companyEmail,
       COALESCE(o.phone, bs.phone) as companyPhone,
       COALESCE(o.address, bs.address) as companyAddress,
       bs.city as companyCity,
       COALESCE(o.state, bs.state) as companyState,
       COALESCE(o.pincode, bs.pincode) as companyPincode
     FROM organizations o
     LEFT JOIN business_settings bs ON bs.organization_id = o.id
     WHERE o.id = ?
     LIMIT 1`,
    [params.id]
  )) as [Record<string, unknown>[], unknown]

  if (!rows[0]) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const [members] = (await db.execute(
    `SELECT u.id, u.name, u.email, om.role, om.status, om.created_at
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ?
     ORDER BY om.created_at ASC`,
    [params.id]
  )) as [unknown[], unknown]

  return NextResponse.json({
    organization: {
      ...rows[0],
      companyName: rows[0].companyName ?? rows[0].name,
      companyEmail: rows[0].ownerEmail ?? rows[0].companyEmail,
    },
    members,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const orgId = params?.id
  if (!orgId) {
    return NextResponse.json({ error: 'Organization id is required' }, { status: 400 })
  }

  try {
    await ensureOrganizationSchema()
    const body = await req.json()
    const data = updateOrgSchema.parse(body)

    const [existing] = (await db.execute('SELECT id FROM organizations WHERE id = ? LIMIT 1', [
      orgId,
    ])) as [{ id: string }[], unknown]
    if (!existing[0]) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: (string | number)[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name.trim())
    }
    if (data.status !== undefined) {
      updates.push('status = ?')
      values.push(data.status)
    }
    if (data.plan !== undefined) {
      updates.push('plan = ?')
      values.push(data.plan)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(orgId)
    await db.execute(
      `UPDATE organizations SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    )

    if (data.name !== undefined) {
      await db.execute(
        'UPDATE business_settings SET company_name = ? WHERE organization_id = ?',
        [data.name.trim(), orgId]
      ).catch(() => {})
    }

    const [rows] = (await db.execute('SELECT * FROM organizations WHERE id = ?', [
      orgId,
    ])) as [Record<string, unknown>[], unknown]

    return NextResponse.json(rows[0])
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(err) }, { status: 400 })
    }
    console.error('PATCH /api/superadmin/organizations/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const [existing] = (await db.execute('SELECT id, slug FROM organizations WHERE id = ? LIMIT 1', [
    params.id,
  ])) as [{ id: string; slug: string }[], unknown]

  if (!existing[0]) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  await db.execute('DELETE FROM organizations WHERE id = ?', [params.id])

  return NextResponse.json({ message: 'Organization suspended' })
}
