import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensureDeliveryChallanSchema } from '@/lib/ensure-delivery-challan-schema'
import { generateDeliveryChallanPdfBuffer } from '@/lib/delivery-challan-pdf'
import { buildPdfParties, parseQuotationPartyDetails } from '@/lib/quotation-party'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('delivery-challans', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensureDeliveryChallanSchema()])

    const [challanRows] = await db.execute(
      `SELECT dc.id, dc.challan_no, dc.customer_id, dc.date, dc.completion_date, dc.terms, dc.party_details
       FROM delivery_challans dc
       WHERE dc.id = ? AND dc.organization_id = ?`,
      [params.id, organizationId]
    ) as any[]

    const challan = challanRows[0]
    if (!challan) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [customerRows] = await db.execute(
      `SELECT name, contact_person, phone, mobile, gstin, pan,
              billing_address, billing_city, billing_state,
              shipping_address, shipping_city, shipping_state
       FROM customers
       WHERE id = ? AND organization_id = ?`,
      [challan.customer_id, organizationId]
    ) as any[]

    const customerRow = customerRows[0] || {}
    const partyDetails = parseQuotationPartyDetails(challan.party_details)
    const parties = buildPdfParties(customerRow, partyDetails)

    const [itemRows] = await db.execute(
      `SELECT ci.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM challan_items ci
       LEFT JOIN products p ON ci.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE ci.challan_id = ?
       ORDER BY ci.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(
      `SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
              terms_condition, delivery_challan_terms
       FROM business_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    ) as any[]

    const s = settingsRows[0] || {}

    const pdfBuffer = generateDeliveryChallanPdfBuffer(
      {
        challan_no: challan.challan_no,
        date: challan.date,
        completion_date: challan.completion_date,
        terms: challan.terms,
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
        termsCondition: s.delivery_challan_terms || s.terms_condition,
      }
    )

    const filename = `${challan.challan_no.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/delivery-challans/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
