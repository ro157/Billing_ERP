import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { registerSchema } from '@/lib/validations'
import { ensureOrganizationSchema } from '@/lib/ensure-organization-schema'
import { ensureOrganizationIdSequencesSchema } from '@/lib/ensure-organization-id-sequences'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { generateUniqueOrgSlug } from '@/lib/tenant'
import { generateOrganizationId } from '@/lib/org-id'

export async function POST(req: NextRequest) {
  const conn = await db.getConnection()
  try {
    await ensureOrganizationSchema()
    await ensureOrganizationIdSequencesSchema()
    await ensureBusinessSettingsBankingColumns()
    const body = await req.json()
    const data = registerSchema.parse(body)

    const [existing] = (await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [
      data.email,
    ])) as [{ id: string }[], unknown]
    if (existing[0]) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    await conn.beginTransaction()

    const orgId = await generateOrganizationId(conn)
    const userId = randomUUID()
    const memberId = randomUUID()
    const settingsId = randomUUID()
    const slug = await generateUniqueOrgSlug(conn, data.organizationName)
    const hashedPassword = await bcrypt.hash(data.password, 12)
    const email = data.email.trim().toLowerCase()

    await conn.execute(
      `INSERT INTO organizations (
        id, name, slug, status, plan, phone, address, gstin, state, pincode, owner_name, owner_email
      ) VALUES (?, ?, ?, 'PENDING', 'free', ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        data.organizationName.trim(),
        slug,
        data.phone,
        data.address,
        data.gstin || null,
        data.state,
        data.pincode,
        data.name.trim(),
        email,
      ]
    )

    await conn.execute(
      `INSERT INTO users (id, name, email, mobile, password, role, status) VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
      [userId, data.name.trim(), email, data.phone, hashedPassword]
    )

    await conn.execute(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, is_default)
       VALUES (?, ?, ?, 'OWNER', 'ACTIVE', 1)`,
      [memberId, orgId, userId]
    )

    await conn.execute(
      `INSERT INTO business_settings (
        id, organization_id, company_name, gstin, address, state, pincode, phone, email,
        invoice_prefix, quotation_prefix, purchase_order_prefix, challan_prefix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INV', 'QT', 'PO', 'DC')`,
      [
        settingsId,
        orgId,
        data.organizationName.trim(),
        data.gstin || null,
        data.address,
        data.state,
        data.pincode,
        data.phone,
        email,
      ]
    )

    await conn.commit()

    return NextResponse.json(
      {
        message:
          'Registration submitted successfully. Your organisation is pending Super Admin approval.',
        organizationId: orgId,
        slug,
        status: 'PENDING',
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    await conn.rollback()
    const e = err as { name?: string; errors?: unknown }
    if (e.name === 'ZodError') {
      return NextResponse.json({ error: e.errors }, { status: 400 })
    }
    console.error('POST /api/auth/register:', err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  } finally {
    conn.release()
  }
}
