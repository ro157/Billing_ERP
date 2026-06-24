import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requireOrganization } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import {
  type DefaultDocumentTermsModule,
  resolveSettingsDocumentTerms,
} from '@/lib/document-terms'

const MODULE_COLUMN_MAP: Record<DefaultDocumentTermsModule, string> = {
  quotation: 'quotation_terms',
  'sales-invoice': 'sales_invoice_terms',
  'purchase-order': 'purchase_order_terms',
  'purchase-invoice': 'purchase_invoice_terms',
  'delivery-challan': 'delivery_challan_terms',
}

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requireOrganization()
  if (error) return error

  const module = req.nextUrl.searchParams.get('module') as DefaultDocumentTermsModule | null
  if (!module || !(module in MODULE_COLUMN_MAP)) {
    return NextResponse.json({ error: 'Invalid module' }, { status: 400 })
  }

  try {
    await ensureBusinessSettingsBankingColumns()
    const column = MODULE_COLUMN_MAP[module]
    const [rows] = await db.execute(
      `SELECT ${column} as moduleTerms, terms_condition as legacyTerms
       FROM business_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    ) as [{ moduleTerms?: string | null; legacyTerms?: string | null }[], unknown]

    const row = rows[0] || {}
    const terms = resolveSettingsDocumentTerms(row.moduleTerms, row.legacyTerms) || ''

    return NextResponse.json({ terms })
  } catch (err) {
    console.error('GET /api/settings/document-terms:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
