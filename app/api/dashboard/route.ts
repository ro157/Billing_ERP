import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('dashboard', 'view')
  if (error) return error

  try {
    const today = new Date().toISOString().slice(0, 10)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

    const [[salesToday]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM invoices
       WHERE DATE(date) = ? AND status != 'CANCELLED'`,
      [today]
    ) as any[][]

    const [[purchasesToday]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM purchases
       WHERE DATE(date) = ? AND status != 'CANCELLED'`,
      [today]
    ) as any[][]

    const [[customerDues]] = await db.execute(
      `SELECT COALESCE(SUM(balance_amount),0) as amount, COUNT(*) as count
       FROM invoices WHERE status IN ('UNPAID','PARTIAL')`
    ) as any[][]

    const [[vendorDues]] = await db.execute(
      `SELECT COALESCE(SUM(balance_amount),0) as amount, COUNT(*) as count
       FROM purchases WHERE status IN ('UNPAID','PARTIAL')`
    ) as any[][]

    const [[pendingQuotRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM quotations WHERE status IN ('DRAFT','SENT')`
    ) as any[][]

    const [[openPORow]] = await db.execute(
      `SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('DRAFT','SENT','PARTIAL')`
    ) as any[][]

    const [[lowStockRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM products WHERE current_stock <= low_stock_alert AND is_active = 1`
    ) as any[][]

    const [monthlySales] = await db.execute(
      `SELECT DATE_FORMAT(date, '%Y-%m') as month,
         COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM invoices
       WHERE date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND status != 'CANCELLED'
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY month ASC`
    ) as any[][]

    const [monthlyPurchases] = await db.execute(
      `SELECT DATE_FORMAT(date, '%Y-%m') as month,
         COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchases
       WHERE date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND status != 'CANCELLED'
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY month ASC`
    ) as any[][]

    const [[gstRow]] = await db.execute(
      `SELECT COALESCE(SUM(cgst_amount),0) as cgst,
              COALESCE(SUM(sgst_amount),0) as sgst,
              COALESCE(SUM(igst_amount),0) as igst,
              COALESCE(SUM(tax_amount),0) as total
       FROM invoices
       WHERE date >= ? AND status != 'CANCELLED'`,
      [startOfMonth]
    ) as any[][]

    return NextResponse.json({
      salesToday:          { amount: Number(salesToday.amount),    count: Number(salesToday.count) },
      purchasesToday:      { amount: Number(purchasesToday.amount), count: Number(purchasesToday.count) },
      customerDues:        { amount: Number(customerDues.amount),  count: Number(customerDues.count) },
      vendorDues:          { amount: Number(vendorDues.amount),    count: Number(vendorDues.count) },
      pendingQuotations:   Number(pendingQuotRow.count),
      openPOs:             Number(openPORow.count),
      lowStockCount:       Number(lowStockRow.count),
      monthlySales,
      monthlyPurchases,
      gstSummary: {
        cgst:  Number(gstRow.cgst),
        sgst:  Number(gstRow.sgst),
        igst:  Number(gstRow.igst),
        total: Number(gstRow.total),
      },
    })
  } catch (err: any) {
    console.error('Dashboard API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

