import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { ensureInvoiceSchema } from '@/lib/ensure-invoice-schema'
import { generateInvoicePdfBuffer } from '@/lib/quotation-pdf'
import { parseInvoiceCopiesParam } from '@/lib/invoice-copy'
import { buildPdfParties, parseQuotationPartyDetails } from '@/lib/quotation-party'
import { roundToTwo } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('billing', 'view')
  if (error) return error

  try {
    await Promise.all([ensureBusinessSettingsBankingColumns(), ensureInvoiceSchema()])

    const [invoiceRows] = await db.execute(
      `SELECT i.id, i.invoice_no, i.customer_id, i.date, i.due_date,
              i.gst_type, i.subtotal, i.discount_amount, i.tax_amount, i.total_amount,
              i.paid_amount, i.balance_amount, i.notes, i.terms, i.party_details
       FROM invoices i
       WHERE i.id = ? AND i.organization_id = ?`,
      [params.id, organizationId]
    ) as any[]

    const invoice = invoiceRows[0]
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [customerRows] = await db.execute(
      `SELECT name, contact_person, phone, mobile, gstin, pan,
              billing_address, billing_city, billing_state,
              shipping_address, shipping_city, shipping_state
       FROM customers
       WHERE id = ? AND organization_id = ?`,
      [invoice.customer_id, organizationId]
    ) as any[]

    const customerRow = customerRows[0] || {}
    const partyDetails = parseQuotationPartyDetails(invoice.party_details)
    const parties = buildPdfParties(customerRow, partyDetails)

    const [itemRows] = await db.execute(
      `SELECT ii.*, p.name as product_name, p.hsn_code, p.sac_code, u.short_name as unit_short
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE ii.invoice_id = ?
       ORDER BY ii.id`,
      [params.id]
    ) as any[]

    const [settingsRows] = await db.execute(`
      SELECT company_name, gstin, pan, address, city, state, pincode, phone, email, website, logo,
             bank_name, bank_account, bank_ifsc, bank_branch, bank_micr, upi_id, terms_condition
      FROM business_settings WHERE organization_id = ? LIMIT 1
    `, [organizationId]) as any[]

    const s = settingsRows[0] || {}
    const preRound = roundToTwo(
      Number(invoice.subtotal) - Number(invoice.discount_amount) + Number(invoice.tax_amount)
    )
    const roundOff = roundToTwo(Number(invoice.total_amount) - preRound)

    const copies = parseInvoiceCopiesParam(req.nextUrl.searchParams.get('copies'))

    const pdfBuffer = generateInvoicePdfBuffer(
      {
        invoice_no: invoice.invoice_no,
        date: invoice.date,
        due_date: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        discount_amount: Number(invoice.discount_amount),
        tax_amount: Number(invoice.tax_amount),
        round_off: roundOff,
        total_amount: Number(invoice.total_amount),
        paid_amount: Number(invoice.paid_amount) || 0,
        balance_amount: Number(invoice.balance_amount) || 0,
        gst_type: invoice.gst_type,
        terms: invoice.terms,
        notes: invoice.notes,
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
        termsCondition: s.terms_condition,
      },
      copies
    )

    const filename = `${invoice.invoice_no.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/invoices/[id]/pdf:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
