import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('reports', 'view')
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

  if (fromDate) { dateConditions.push('date >= ?'); params.push(fromDate) }
  if (toDate) { dateConditions.push('date <= ?'); params.push(toDate) }
  const dateWhere = dateConditions.length ? 'WHERE ' + dateConditions.join(' AND ') : ''

  if (type === 'sales') {
    const [rows] = await db.execute(
      `SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       ${dateWhere ? dateWhere.replace('date', 'i.date') : ''} ORDER BY i.date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total_sales, COALESCE(SUM(paid_amount),0) as total_received,
              COALESCE(SUM(balance_amount),0) as total_outstanding, COUNT(*) as total_count
       FROM invoices ${dateWhere ? dateWhere.replace('date', 'date') : ''}`,
      params
    ) as any[]
    return NextResponse.json({ data: rows, summary: summary[0] })
  }

  if (type === 'purchases') {
    const [rows] = await db.execute(
      `SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
       ${dateWhere ? dateWhere.replace('date', 'p.date') : ''} ORDER BY p.date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total_purchases, COALESCE(SUM(paid_amount),0) as total_paid,
              COALESCE(SUM(balance_amount),0) as total_outstanding, COUNT(*) as total_count
       FROM purchases ${dateWhere ? dateWhere.replace('date', 'date') : ''}`,
      params
    ) as any[]
    return NextResponse.json({ data: rows, summary: summary[0] })
  }

  if (type === 'stock') {
    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name, u.short_name as unit_short_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.is_active = 1 ORDER BY p.name ASC LIMIT ? OFFSET ?`,
      [limit, offset]
    ) as any[]
    const [summary] = await db.execute(
      `SELECT COUNT(*) as total_products,
              SUM(CASE WHEN current_stock <= low_stock_alert THEN 1 ELSE 0 END) as low_stock_count,
              SUM(current_stock * purchase_price) as total_stock_value
       FROM products WHERE is_active = 1`
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
       ${dateWhere ? dateWhere.replace('date', 'i.date') : ''}
       GROUP BY DATE_FORMAT(i.date, '%Y-%m') ORDER BY period ASC`,
      params
    ) as any[]
    return NextResponse.json({ data: rows })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
