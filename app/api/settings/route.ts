import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { businessSettingsSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${buffer.toString('base64')}`
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('settings', 'view')
  if (error) return error

  try {
    const [rows] = await db.execute(`
      SELECT
        id,
        company_name as companyName,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        logo,
        bank_name as bankName,
        bank_account as bankAccount,
        bank_ifsc as bankIfsc,
        bank_branch as bankBranch,
        invoice_prefix as invoicePrefix,
        quotation_prefix as quotationPrefix,
        purchase_order_prefix as purchaseOrderPrefix,
        challan_prefix as challanPrefix,
        terms_condition as termsCondition,
        created_at,
        updated_at
      FROM business_settings
      LIMIT 1
    `) as any[]

    return NextResponse.json(rows[0] || null)
  } catch (error) {
    console.error('Error fetching business settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { error } = await requirePermission('settings', 'edit')
  if (error) return error

  try {
    let body: any
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      body = {}
      for (const [key, value] of Array.from(formData.entries())) {
        if (key === 'logo' && value instanceof File && value.size > 0) {
          body.logo = await fileToDataUrl(value)
        } else if (typeof value === 'string') {
          body[key] = value
        }
      }
    } else {
      body = await req.json()
    }

    const data = businessSettingsSchema.parse(body)
    const [existingRows] = await db.execute('SELECT id, logo FROM business_settings LIMIT 1') as any[]
    const existing = existingRows[0]
    const logo = data.logo ?? existing?.logo ?? null

    if (existing) {
      // Update existing settings
      await db.execute(
        `UPDATE business_settings SET
          company_name = ?,
          gstin = ?,
          pan = ?,
          address = ?,
          city = ?,
          state = ?,
          pincode = ?,
          phone = ?,
          email = ?,
          website = ?,
          logo = ?,
          bank_name = ?,
          bank_account = ?,
          bank_ifsc = ?,
          bank_branch = ?,
          invoice_prefix = ?,
          quotation_prefix = ?,
          purchase_order_prefix = ?,
          challan_prefix = ?,
          terms_condition = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.companyName,
          data.gstin || null,
          data.pan || null,
          data.address || null,
          data.city || null,
          data.state || null,
          data.pincode || null,
          data.phone || null,
          data.email || null,
          data.website || null,
          logo,
          data.bankName || null,
          data.bankAccount || null,
          data.bankIfsc || null,
          data.bankBranch || null,
          data.invoicePrefix,
          data.quotationPrefix,
          data.purchaseOrderPrefix,
          data.challanPrefix,
          data.termsCondition || null,
          existing.id
        ]
      )
    } else {
      // Insert new settings
      const id = randomUUID()
      await db.execute(
        `INSERT INTO business_settings (
          id, company_name, gstin, pan, address, city, state, pincode,
          phone, email, website, logo, bank_name, bank_account, bank_ifsc, bank_branch,
          invoice_prefix, quotation_prefix, purchase_order_prefix, challan_prefix, terms_condition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.companyName,
          data.gstin || null,
          data.pan || null,
          data.address || null,
          data.city || null,
          data.state || null,
          data.pincode || null,
          data.phone || null,
          data.email || null,
          data.website || null,
          logo,
          data.bankName || null,
          data.bankAccount || null,
          data.bankIfsc || null,
          data.bankBranch || null,
          data.invoicePrefix,
          data.quotationPrefix,
          data.purchaseOrderPrefix,
          data.challanPrefix,
          data.termsCondition || null
        ]
      )
    }

    // Return updated settings
    const [rows] = await db.execute(`
      SELECT
        id,
        company_name as companyName,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        logo,
        bank_name as bankName,
        bank_account as bankAccount,
        bank_ifsc as bankIfsc,
        bank_branch as bankBranch,
        invoice_prefix as invoicePrefix,
        quotation_prefix as quotationPrefix,
        purchase_order_prefix as purchaseOrderPrefix,
        challan_prefix as challanPrefix,
        terms_condition as termsCondition,
        created_at,
        updated_at
      FROM business_settings
      LIMIT 1
    `) as any[]

    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('Error updating business settings:', err)
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

