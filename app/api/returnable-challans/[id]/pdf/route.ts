import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensureReturnableChallanSchema } from '@/lib/ensure-returnable-challan-schema'
import { generateReturnableChallanPdfBuffer } from '@/lib/quotation-pdf'
import { parseInvoiceCopiesParam } from '@/lib/invoice-copy'
import { buildPdfParties, parseQuotationPartyDetails } from '@/lib/quotation-party'
import { computeSalesDocumentItemTotals } from '@/lib/sales-document-totals'
import { roundToNearestRupee, roundToTwo } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('returnable-challans', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensureReturnableChallanSchema()])

    const [challanRows] = await db.execute(
      `SELECT rc.id, rc.challan_no, rc.customer_id, rc.date, rc.return_date, rc.terms, rc.party_details, rc.include_pricing
       FROM returnable_challans rc
       WHERE rc.id = ? AND rc.organization_id = ?`,
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
      `SELECT rci.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM returnable_challan_items rci
       LEFT JOIN products p ON rci.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE rci.challan_id = ?
       ORDER BY rci.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(
      `SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
              bank_name, bank_account, bank_ifsc, bank_branch, bank_micr, upi_id,
              terms_condition, returnable_challan_terms
       FROM business_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    ) as any[]

    const s = settingsRows[0] || {}

    const buyerState = parties.buyer.billing_state || customerRow.billing_state
    const gstType: 'CGST_SGST' | 'IGST' =
      s.state && buyerState && s.state.trim().toLowerCase() !== buyerState.trim().toLowerCase()
        ? 'IGST'
        : 'CGST_SGST'

    const includePricing = Boolean(challan.include_pricing)

    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let grandTotal = 0

    const pdfItems = itemRows.map((item: any) => {
      const rate = includePricing ? Number(item.rate) || 0 : 0
      const discount = includePricing ? Number(item.discount) || 0 : 0
      const gstRate = includePricing ? Number(item.gst_rate) || 0 : 0
      const qty = Number(item.quantity_issued) || 0
      const totals = computeSalesDocumentItemTotals(
        { quantity: qty, rate, discount, gstRate },
        gstType
      )
      subtotal += totals.taxable
      totalDiscount += totals.discAmt
      totalTax += totals.cgst + totals.sgst + totals.igst
      grandTotal += totals.total

      return {
        description: item.description,
        product_name: item.product_name,
        hsn_code: item.hsn_code,
        sac_code: item.sac_code,
        unit_short: item.unit_short,
        quantity: qty,
        rate,
        discount,
        gst_rate: gstRate,
        amount: includePricing ? Number(item.amount) || totals.total : 0,
      }
    })

    const roundedGrandTotal = includePricing ? roundToNearestRupee(roundToTwo(grandTotal)) : 0
    const roundOff = includePricing ? roundToTwo(roundedGrandTotal - roundToTwo(grandTotal)) : 0

    const copies = parseInvoiceCopiesParam(req.nextUrl.searchParams.get('copies'))

    const pdfBuffer = generateReturnableChallanPdfBuffer(
      {
        challan_no: challan.challan_no,
        date: challan.date,
        completion_date: challan.return_date,
        subtotal: includePricing ? roundToTwo(subtotal) : 0,
        discount_amount: includePricing ? roundToTwo(totalDiscount) : 0,
        tax_amount: includePricing ? roundToTwo(totalTax) : 0,
        round_off: roundOff,
        total_amount: roundedGrandTotal,
        gst_type: gstType,
        terms: challan.terms,
        include_pricing: includePricing,
        customer: parties.buyer,
        consignee: parties.consignee,
        items: pdfItems,
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
        termsCondition: s.returnable_challan_terms || s.terms_condition,
      },
      copies
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
    console.error('GET /api/returnable-challans/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
