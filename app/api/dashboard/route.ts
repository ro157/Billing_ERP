import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('dashboard', 'view')
  if (error) return error

  try {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const monthParam = searchParams.get('month') || ''
    const today = now.toISOString().slice(0, 10)

    const [[salesToday]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM invoices
       WHERE DATE(date) = ?`,
      [today]
    ) as any[][]

    const [[purchasesToday]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as count FROM purchases
       WHERE DATE(date) = ? AND status != 'CANCELLED'`,
      [today]
    ) as any[][]

    const [[pendingQuotRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM quotations WHERE converted_to_id IS NULL`
    ) as any[][]

    const [[lowStockRow]] = await db.execute(
      `SELECT COUNT(*) as count FROM products WHERE current_stock <= low_stock_alert AND is_active = 1`
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
         WHERE DATE_FORMAT(date, '%Y-%m') = ?
         GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
         ORDER BY period ASC`,
        [monthKey]
      ) as any[][]
      const [dailyPurchases] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m-%d') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM purchases
         WHERE DATE_FORMAT(date, '%Y-%m') = ? AND status != 'CANCELLED'
         GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
         ORDER BY period ASC`,
        [monthKey]
      ) as any[][]
      chartSales = dailySales
      chartPurchases = dailyPurchases
    } else {
      const [monthlySales] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM invoices
         WHERE YEAR(date) = ?
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY period ASC`,
        [year]
      ) as any[][]
      const [monthlyPurchases] = await db.execute(
        `SELECT DATE_FORMAT(date, '%Y-%m') as period,
           COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
         FROM purchases
         WHERE YEAR(date) = ? AND status != 'CANCELLED'
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY period ASC`,
        [year]
      ) as any[][]
      chartSales = monthlySales
      chartPurchases = monthlyPurchases
    }

    return NextResponse.json({
      salesToday: { amount: Number(salesToday.amount), count: Number(salesToday.count) },
      purchasesToday: { amount: Number(purchasesToday.amount), count: Number(purchasesToday.count) },
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
