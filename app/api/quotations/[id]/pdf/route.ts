import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensureQuotationSchema } from '@/lib/ensure-quotation-schema'
import { generateQuotationPdfBuffer } from '@/lib/quotation-pdf'
import { buildPdfParties, parseQuotationPartyDetails } from '@/lib/quotation-party'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('quotations', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensureQuotationSchema()])

    const [quotationRows] = await db.execute(
      `SELECT q.id, q.quotation_no, q.customer_id, q.date, q.valid_until,
              q.subtotal, q.discount_amount, q.tax_amount, q.round_off, q.total_amount,
              q.notes, q.terms, q.party_details
       FROM quotations q
       WHERE q.id = ? AND q.organization_id = ?`,
      [params.id, organizationId]
    ) as any[]

    const quotation = quotationRows[0]
    if (!quotation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [customerRows] = await db.execute(
      `SELECT name, contact_person, phone, mobile, gstin, pan,
              billing_address, billing_city, billing_state,
              shipping_address, shipping_city, shipping_state
       FROM customers
       WHERE id = ? AND organization_id = ?`,
      [quotation.customer_id, organizationId]
    ) as any[]

    const customerRow = customerRows[0] || {}
    const partyDetails = parseQuotationPartyDetails(quotation.party_details)
    const parties = buildPdfParties(customerRow, partyDetails)

    const [itemRows] = await db.execute(
      `SELECT qi.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM quotation_items qi
       LEFT JOIN products p ON qi.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE qi.quotation_id = ?
       ORDER BY qi.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(`
      SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
             bank_name, bank_account, bank_ifsc, bank_branch, bank_micr, upi_id,
             terms_condition, quotation_terms
      FROM business_settings WHERE organization_id = ? LIMIT 1
    `, [organizationId]) as any[]

    const s = settingsRows[0] || {}

    const pdfBuffer = generateQuotationPdfBuffer(
      {
        quotation_no: quotation.quotation_no,
        date: quotation.date,
        valid_until: quotation.valid_until,
        subtotal: Number(quotation.subtotal),
        discount_amount: Number(quotation.discount_amount),
        tax_amount: Number(quotation.tax_amount),
        round_off: Number(quotation.round_off) || 0,
        total_amount: Number(quotation.total_amount),
        terms: quotation.terms,
        notes: quotation.notes,
        customer: parties.buyer,
        consignee: parties.consignee,
        items: itemRows,
      },
      {
        companyName: s.company_name || 'Company Name',
        gstin: s.gstin,
        pan: s.pan,
        address: s.address,
        city: s.city,
        state: s.state,
        pincode: s.pincode,
        phone: s.phone,
        email: s.email,
        website: s.website,
        logo: s.logo,
        bankName: s.bank_name,
        bankAccount: s.bank_account,
        bankIfsc: s.bank_ifsc,
        bankBranch: s.bank_branch,
        bankMicr: s.bank_micr,
        upiId: s.upi_id,
        termsCondition: s.quotation_terms || s.terms_condition,
      }
    )

    const filename = `${quotation.quotation_no.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/quotations/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
