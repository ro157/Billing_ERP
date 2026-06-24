import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { error, organizationId } = await requirePermission('dashboard', 'view')
  if (error) return error

  try {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const monthParam = searchParams.get('month') || ''
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [[salesThisMonth]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM invoices
       WHERE organization_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?`,
      [organizationId, currentMonthKey]
    ) as any[][]

    const [[purchasesThisMonth]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM purchases
       WHERE organization_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? AND status != 'CANCELLED'`,
      [organizationId, currentMonthKey]
    ) as any[][]

    const [[pendingQuotRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM quotations WHERE organization_id = ? AND converted_to_id IS NULL`,
      [organizationId]
    ) as any[][]

    const [[lowStockRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM products WHERE organization_id = ? AND current_stock <= low_stock_alert AND is_active = 1`,
      [organizationId]
    ) as any[][]

    let chartType: 'monthly' | 'daily' = 'monthly'
    let chartSales: any[] = []
    let chartPurchases: any[] = []

    if (monthParam && /^\d{1,2}$/.test(monthParam)) {
      const month = monthParam.padStart(2, '0')
      const monthKey = `${year}-${month}`

      chartType = 'daily'
      const [dailySales] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m-%d') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM invoices
         WHERE organization_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?
         GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
         ORDER BY period ASC`,
        [organizationId, monthKey]
      ) as any[][]
      const [dailyPurchases] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m-%d') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM purchases
         WHERE organization_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? AND status != 'CANCELLED'
         GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
         ORDER BY period ASC`,
        [organizationId, monthKey]
      ) as any[][]
      chartSales = dailySales
      chartPurchases = dailyPurchases
    } else {
      const [monthlySales] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM invoices
         WHERE organization_id = ? AND YEAR(date) = ?
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY period ASC`,
        [organizationId, year]
      ) as any[][]
      const [monthlyPurchases] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM purchases
         WHERE organization_id = ? AND YEAR(date) = ? AND status != 'CANCELLED'
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY period ASC`,
        [organizationId, year]
      ) as any[][]
      chartSales = monthlySales
      chartPurchases = monthlyPurchases
    }

    return NextResponse.json({
      salesThisMonth: { amount: Number(salesThisMonth.amount), count: Number(salesThisMonth.count) },
      purchasesThisMonth: { amount: Number(purchasesThisMonth.amount), count: Number(purchasesThisMonth.count) },
      pendingQuotations: Number(pendingQuotRow.count),
      lowStockCount: Number(lowStockRow.count),
      chartType,
      chartYear: year,
      chartMonth: monthParam || null,
      chartSales,
      chartPurchases,
    })
  } catch (err: any) {
    console.error('Dashboard API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
