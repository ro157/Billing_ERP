import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { appendOrgFilter } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('reports', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'sales'
  const fromDate = searchParams.get('fromDate')
  const toDate = searchParams.get('toDate')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const dateConditions: string[] = []
  const params: any[] = []
  appendOrgFilter(dateConditions, params, organizationId!, 'i')

  if (fromDate) { dateConditions.push('i.date >= ?'); params.push(fromDate) }
  if (toDate) { dateConditions.push('i.date <= ?'); params.push(toDate) }
  const invoiceDateWhere = 'WHERE ' + dateConditions.join(' AND ')

  if (type === 'sales') {
    const [rows] = await db.execute(
      `SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       ${invoiceDateWhere} ORDER BY i.date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total_sales, COALESCE(SUM(paid_amount),0) as total_received,
              COALESCE(SUM(balance_amount),0) as total_outstanding, COUNT(*) as total_count
       FROM invoices i ${invoiceDateWhere}`,
      params
    ) as any[]
    return NextResponse.json({ data: rows, summary: summary[0] })
  }

  if (type === 'purchases') {
    const purchaseConditions: string[] = []
    const purchaseParams: any[] = []
    appendOrgFilter(purchaseConditions, purchaseParams, organizationId!, 'p')
    if (fromDate) { purchaseConditions.push('p.date >= ?'); purchaseParams.push(fromDate) }
    if (toDate) { purchaseConditions.push('p.date <= ?'); purchaseParams.push(toDate) }
    const purchaseDateWhere = 'WHERE ' + purchaseConditions.join(' AND ')

    const [rows] = await db.execute(
      `SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
       ${purchaseDateWhere} ORDER BY p.date DESC LIMIT ? OFFSET ?`,
      [...purchaseParams, limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total_purchases, COALESCE(SUM(paid_amount),0) as total_paid,
              COALESCE(SUM(balance_amount),0) as total_outstanding, COUNT(*) as total_count
       FROM purchases p ${purchaseDateWhere}`,
      purchaseParams
    ) as any[]
    return NextResponse.json({ data: rows, summary: summary[0] })
  }

  if (type === 'stock') {
    const stockConditions: string[] = ['p.is_active = 1']
    const stockParams: any[] = []
    appendOrgFilter(stockConditions, stockParams, organizationId!, 'p')
    const stockWhere = 'WHERE ' + stockConditions.join(' AND ')

    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name, u.short_name as unit_short_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN units u ON p.unit_id = u.id
       ${stockWhere} ORDER BY p.name ASC LIMIT ? OFFSET ?`,
      [...stockParams, limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COUNT(*) as total_products,
              SUM(CASE WHEN current_stock <= low_stock_alert THEN 1 ELSE 0 END) as low_stock_count,
              SUM(current_stock * purchase_price) as total_stock_value
       FROM products p ${stockWhere}`,
      stockParams
    ) as any[]
    return NextResponse.json({ data: rows, summary: summary[0] })
  }

  if (type === 'gst') {
    const [rows] = await db.execute(
      `SELECT DATE_FORMAT(i.date, '%Y-%m') as period,
              COALESCE(SUM(i.taxable_amount),0) as taxable_amount,
              COALESCE(SUM(i.cgst_amount),0) as cgst,
              COALESCE(SUM(i.sgst_amount),0) as sgst,
              COALESCE(SUM(i.igst_amount),0) as igst,
              COALESCE(SUM(i.total_amount),0) as total
       FROM invoices i
       ${invoiceDateWhere}
       GROUP BY DATE_FORMAT(i.date, '%Y-%m') ORDER BY period ASC`,
      params
    ) as any[]
    return NextResponse.json({ data: rows })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
