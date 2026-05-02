import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { businessSettingsSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('settings', 'view')
  if (error) return error
  const [rows] = await db.execute('SELECT * FROM business_settings LIMIT 1') as any[]
  return NextResponse.json(rows[0] || null)
}

export async function PUT(req: NextRequest) {
  const { error } = await requirePermission('settings', 'edit')
  if (error) return error
  try {
    const body = await req.json()
    const data = businessSettingsSchema.parse(body)
    const [existing] = await db.execute('SELECT id FROM business_settings LIMIT 1') as any[]

    if (existing[0]) {
      await db.execute(
        `UPDATE business_settings SET company_name=?, gstin=?, pan=?, address=?, city=?, state=?,
          pincode=?, phone=?, email=?, website=?, bank_name=?, bank_account=?, bank_ifsc=?,
          bank_branch=?, invoice_prefix=?, po_prefix=?, quot_prefix=?, challan_prefix=?, terms_condition=?
         WHERE id=?`,
        [data.companyName, data.gstin||null, data.pan||null, data.address||null, data.city||null,
         data.state||null, data.pincode||null, data.phone||null, data.email||null, data.website||null,
         data.bankName||null, data.bankAccount||null, data.bankIfsc||null, data.bankBranch||null,
         data.invoicePrefix||'INV', data.poPrefix||'PO', data.quotPrefix||'QT', data.challanPrefix||'DC',
         data.termsCondition||null, existing[0].id]
      )
    } else {
      const id = randomUUID()
      await db.execute(
        `INSERT INTO business_settings (id, company_name, gstin, pan, address, city, state, pincode,
          phone, email, website, bank_name, bank_account, bank_ifsc, bank_branch,
          invoice_prefix, po_prefix, quot_prefix, challan_prefix, terms_condition)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, data.companyName, data.gstin||null, data.pan||null, data.address||null, data.city||null,
         data.state||null, data.pincode||null, data.phone||null, data.email||null, data.website||null,
         data.bankName||null, data.bankAccount||null, data.bankIfsc||null, data.bankBranch||null,
         data.invoicePrefix||'INV', data.poPrefix||'PO', data.quotPrefix||'QT', data.challanPrefix||'DC',
         data.termsCondition||null]
      )
    }
    const [rows] = await db.execute('SELECT * FROM business_settings LIMIT 1') as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
