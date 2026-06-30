import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensurePurchaseSchema } from '@/lib/ensure-purchase-schema'
import { generatePurchasePdfBuffer } from '@/lib/quotation-pdf'
import { parseInvoiceCopiesParam } from '@/lib/invoice-copy'
import { vendorToPdfParty } from '@/lib/vendor-pdf-party'
import { roundToTwo } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchases', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensurePurchaseSchema()])

    const [purchaseRows] = await db.execute(
      `SELECT p.id, p.purchase_no, p.vendor_id, p.date, p.due_date, p.gst_type,
              p.bill_no, p.bill_date, p.subtotal, p.discount_amount, p.tax_amount,
              p.round_off, p.total_amount, p.paid_amount, p.balance_amount, p.notes, p.terms
       FROM purchases p
       WHERE p.id = ? AND p.organization_id = ?`,
      [params.id, organizationId]
    ) as any[]

    const purchase = purchaseRows[0]
    if (!purchase) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [vendorRows] = await db.execute(
      `SELECT name, contact_person, phone, mobile, gstin, pan, address, city, state
       FROM vendors
       WHERE id = ? AND organization_id = ?`,
      [purchase.vendor_id, organizationId]
    ) as any[]

    const [itemRows] = await db.execute(
      `SELECT pi.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(
      `SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
              bank_name, bank_account, bank_ifsc, bank_branch, bank_micr, upi_id,
              terms_condition, purchase_invoice_terms
       FROM business_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    ) as any[]

    const s = settingsRows[0] || {}
    const roundOff =
      purchase.round_off != null
        ? Number(purchase.round_off)
        : roundToTwo(
            Number(purchase.total_amount) -
              (Number(purchase.subtotal) - Number(purchase.discount_amount) + Number(purchase.tax_amount))
          )

    const copies = parseInvoiceCopiesParam(req.nextUrl.searchParams.get('copies'))

    const pdfBuffer = generatePurchasePdfBuffer(
      {
        purchase_no: purchase.purchase_no,
        date: purchase.date,
        due_date: purchase.due_date,
        bill_no: purchase.bill_no,
        bill_date: purchase.bill_date,
        subtotal: Number(purchase.subtotal),
        discount_amount: Number(purchase.discount_amount),
        tax_amount: Number(purchase.tax_amount),
        round_off: roundOff,
        total_amount: Number(purchase.total_amount),
        paid_amount: Number(purchase.paid_amount) || 0,
        balance_amount: Number(purchase.balance_amount) || 0,
        gst_type: purchase.gst_type,
        terms: purchase.terms,
        vendor: vendorToPdfParty(vendorRows[0] || {}),
        items: itemRows.map((item: any) => ({
          description: item.description,
          product_name: item.product_name,
          hsn_code: item.hsn_code,
          sac_code: item.sac_code,
          unit_short: item.unit_short,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          discount: Number(item.discount) || 0,
          gst_rate: Number(item.gst_rate) || 0,
          amount: Number(item.amount) || 0,
        })),
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
        termsCondition: s.purchase_invoice_terms || s.terms_condition,
      },
      copies
    )

    const filename = `${purchase.purchase_no.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/purchases/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
