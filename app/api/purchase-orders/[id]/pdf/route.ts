import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensureDocumentTermsColumns } from '@/lib/ensure-purchase-schema'
import { generatePurchaseOrderPdfBuffer } from '@/lib/quotation-pdf'
import { parseInvoiceCopiesParam } from '@/lib/invoice-copy'
import { vendorToPdfParty } from '@/lib/vendor-pdf-party'
import { resolveStoredIncludePricing } from '@/lib/purchase-include-pricing'
import { computePurchaseOrderItemTotals } from '@/lib/purchase-totals'
import { roundToTwo } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensureDocumentTermsColumns()])

    const [poRows] = await db.execute(
      `SELECT po.id, po.po_no, po.vendor_id, po.date, po.expected_date,
              po.subtotal, po.discount_amount, po.tax_amount, po.total_amount, po.notes, po.terms, po.include_pricing
       FROM purchase_orders po
       WHERE po.id = ? AND po.organization_id = ?`,
      [params.id, organizationId]
    ) as any[]

    const po = poRows[0]
    if (!po) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [vendorRows] = await db.execute(
      `SELECT name, contact_person, phone, mobile, gstin, pan, address, city, state
       FROM vendors
       WHERE id = ? AND organization_id = ?`,
      [po.vendor_id, organizationId]
    ) as any[]

    const vendorRow = vendorRows[0] || {}

    const [itemRows] = await db.execute(
      `SELECT poi.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM purchase_order_items poi
       LEFT JOIN products p ON poi.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE poi.purchase_order_id = ?
       ORDER BY poi.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(
      `SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
              bank_name, bank_account, bank_ifsc, bank_branch, bank_micr, upi_id,
              terms_condition, purchase_order_terms
       FROM business_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    ) as any[]

    const s = settingsRows[0] || {}

    const buyerState = vendorRow.state
    const gstType: 'CGST_SGST' | 'IGST' =
      s.state && buyerState && s.state.trim().toLowerCase() !== buyerState.trim().toLowerCase()
        ? 'IGST'
        : 'CGST_SGST'

    const includePricing = resolveStoredIncludePricing(po.include_pricing, itemRows, po.subtotal)

    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let grandTotal = 0

    const pdfItems = itemRows.map((item: any) => {
      const rate = includePricing ? Number(item.rate) || 0 : 0
      const discount = includePricing ? Number(item.discount) || 0 : 0
      const gstRate = includePricing ? Number(item.gst_rate) || 0 : 0
      const totals = computePurchaseOrderItemTotals(
        {
          quantity: Number(item.quantity) || 0,
          rate,
          discount,
          gstRate,
        },
        gstType
      )
      subtotal += Number(item.quantity) * rate
      totalDiscount += totals.discAmt
      totalTax += totals.cgst + totals.sgst + totals.igst
      grandTotal += totals.total

      return {
        description: item.description,
        product_name: item.product_name,
        hsn_code: item.hsn_code,
        sac_code: item.sac_code,
        unit_short: item.unit_short,
        quantity: Number(item.quantity) || 0,
        rate,
        discount,
        gst_rate: gstRate,
        amount: includePricing ? Number(item.amount) || totals.total : 0,
      }
    })

    const preRound = roundToTwo(
      includePricing ? grandTotal : 0
    )
    const roundOff = includePricing ? roundToTwo(Number(po.total_amount) - preRound) : 0

    const copies = parseInvoiceCopiesParam(req.nextUrl.searchParams.get('copies'))

    const pdfBuffer = generatePurchaseOrderPdfBuffer(
      {
        po_no: po.po_no,
        date: po.date,
        expected_date: po.expected_date,
        subtotal: includePricing ? roundToTwo(subtotal) : 0,
        discount_amount: includePricing ? roundToTwo(totalDiscount) : 0,
        tax_amount: includePricing ? roundToTwo(totalTax) : 0,
        round_off: roundOff,
        total_amount: includePricing ? Number(po.total_amount) || roundToTwo(grandTotal + roundOff) : 0,
        gst_type: gstType,
        terms: po.terms,
        include_pricing: includePricing,
        vendor: vendorToPdfParty(vendorRow),
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
        termsCondition: s.purchase_order_terms || s.terms_condition,
      },
      copies
    )

    const filename = `${po.po_no.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/purchase-orders/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
