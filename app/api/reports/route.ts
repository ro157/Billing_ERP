import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'

function mapInvoiceRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    date: row.date,
    status: row.status,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    balanceAmount: row.balance_amount,
    cgstAmount: row.cgst_amount,
    sgstAmount: row.sgst_amount,
    igstAmount: row.igst_amount,
    customerName: row.customer_name || '-',
    customer: { name: row.customer_name },
  }
}

function mapPurchaseRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    purchaseNo: row.purchase_no,
    date: row.date,
    status: row.status,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    balanceAmount: row.balance_amount,
    cgstAmount: row.cgst_amount,
    sgstAmount: row.sgst_amount,
    igstAmount: row.igst_amount,
    vendor: { name: row.vendor_name },
  }
}

function formatProductHsn(hsn?: unknown, sac?: unknown): string {
  const h = hsn ? String(hsn).trim() : ''
  const s = sac ? String(sac).trim() : ''
  if (h && s) return `${h} / ${s}`
  return h || s || '-'
}

function mapProductRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '-',
    hsn: formatProductHsn(row.hsn_code, row.sac_code),
    currentStock: row.current_stock,
    lowStockAlert: row.low_stock_alert,
  }
}

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('reports', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'sales-summary'
  const fromDate = searchParams.get('from') || searchParams.get('fromDate')
  const toDate = searchParams.get('to') || searchParams.get('toDate')
  const limit = parseInt(searchParams.get('limit') || '500', 10)

  const salesTypes = ['sales-summary', 'gst-sales', 'sales']
  const purchaseTypes = ['purchase-summary', 'gst-purchase', 'purchases']
  const stockTypes = ['stock-report', 'stock']
  const lowStockTypes = ['low-stock']

  if (salesTypes.includes(type)) {
    const conditions: string[] = []
    const params: unknown[] = []
    appendOrgFilter(conditions, params, organizationId!, 'i')
    if (fromDate) {
      conditions.push('DATE(i.date) >= ?')
      params.push(fromDate)
    }
    if (toDate) {
      conditions.push('DATE(i.date) <= ?')
      params.push(toDate)
    }
    const where = 'WHERE ' + conditions.join(' AND ')

    const [rows] = await db.execute(
      `SELECT i.id, i.invoice_no, i.date, i.status, i.total_amount, i.paid_amount, i.balance_amount,
              i.cgst_amount, i.sgst_amount, i.igst_amount, c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       ${where}
       ORDER BY i.date ASC, i.invoice_no ASC
       LIMIT ?`,
      [...params, limit]
    ) as [Record<string, unknown>[]]

    const [summaryRows] = await db.execute(
      `SELECT COALESCE(SUM(i.total_amount), 0) AS total_sales,
              COALESCE(SUM(i.paid_amount), 0) AS total_received,
              COALESCE(SUM(i.balance_amount), 0) AS total_outstanding,
              COUNT(*) AS total_count
       FROM invoices i
       ${where}`,
      params
    ) as [Record<string, unknown>[]]

    return NextResponse.json({ data: rows.map(mapInvoiceRow), summary: summaryRows[0] || null })
  }

  if (purchaseTypes.includes(type)) {
    const conditions: string[] = []
    const params: unknown[] = []
    appendOrgFilter(conditions, params, organizationId!, 'p')
    if (fromDate) {
      conditions.push('DATE(p.date) >= ?')
      params.push(fromDate)
    }
    if (toDate) {
      conditions.push('DATE(p.date) <= ?')
      params.push(toDate)
    }
    const where = 'WHERE ' + conditions.join(' AND ')

    const [rows] = await db.execute(
      `SELECT p.id, p.purchase_no, p.date, p.status, p.total_amount, p.paid_amount, p.balance_amount,
              p.cgst_amount, p.sgst_amount, p.igst_amount, v.name AS vendor_name
       FROM purchases p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ${where}
       ORDER BY p.date DESC, p.purchase_no DESC
       LIMIT ?`,
      [...params, limit]
    ) as [Record<string, unknown>[]]

    const [summaryRows] = await db.execute(
      `SELECT COALESCE(SUM(p.total_amount), 0) AS total_purchases,
              COALESCE(SUM(p.paid_amount), 0) AS total_paid,
              COALESCE(SUM(p.balance_amount), 0) AS total_outstanding,
              COUNT(*) AS total_count
       FROM purchases p
       ${where}`,
      params
    ) as [Record<string, unknown>[]]

    return NextResponse.json({ data: rows.map(mapPurchaseRow), summary: summaryRows[0] || null })
  }

  if (stockTypes.includes(type) || lowStockTypes.includes(type)) {
    const conditions: string[] = ['p.is_active = 1']
    const params: unknown[] = []
    appendOrgFilter(conditions, params, organizationId!, 'p')
    if (lowStockTypes.includes(type)) {
      conditions.push('p.current_stock <= COALESCE(p.low_stock_alert, 10)')
    }
    const where = 'WHERE ' + conditions.join(' AND ')

    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.description, p.hsn_code, p.sac_code, p.current_stock, p.low_stock_alert
       FROM products p
       ${where}
       ORDER BY p.name ASC
       LIMIT ?`,
      [...params, limit]
    ) as [Record<string, unknown>[]]

    return NextResponse.json({ data: rows.map(mapProductRow) })
  }

  if (type === 'customer-ledger' || type === 'vendor-ledger') {
    return NextResponse.json({ data: [], message: 'Ledger report coming soon' })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
