'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  TrendingUp, ShoppingCart, FileText, AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { DashboardPageSkeleton } from '@/components/layout/page-loader'

const SalesPurchasesChart = dynamic(
  () =>
    import('@/components/dashboard/sales-purchases-chart').then((m) => ({
      default: m.SalesPurchasesChart,
    })),
  {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-muted" />,
  }
)

interface ChartRow {
  period: string
  total: number
  count: number
}

interface DashboardStats {
  salesToday: { amount: number; count: number }
  purchasesToday: { amount: number; count: number }
  pendingQuotations: number
  lowStockCount: number
  chartType: 'monthly' | 'daily'
  chartYear: number
  chartMonth: string | null
  chartSales: ChartRow[]
  chartPurchases: ChartRow[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function StatCard({
  title, value, sub, icon: Icon, color, badge, href,
}: {
  title: string; value: string; sub?: string; icon: any; color: string; badge?: string; href: string
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          {badge && (
            <Badge variant="secondary" className="mt-3 text-xs">{badge}</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function formatMonthLabel(period: string) {
  const [y, m] = period.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleString('default', { month: 'short', year: '2-digit' })
}

function formatDayLabel(period: string) {
  const d = new Date(period + 'T00:00:00')
  return d.toLocaleString('default', { day: 'numeric', month: 'short' })
}

function getYearMonthKeys(year: number): string[] {
  const keys: string[] = []
  const limit = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12
  for (let m = 1; m <= limit; m++) {
    keys.push(`${year}-${String(m).padStart(2, '0')}`)
  }
  return keys
}

function getDaysInMonth(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate()
  const keys: string[] = []
  const m = String(month).padStart(2, '0')
  for (let d = 1; d <= days; d++) {
    keys.push(`${year}-${m}-${String(d).padStart(2, '0')}`)
  }
  return keys
}

function buildChartData(
  chartType: 'monthly' | 'daily',
  year: number,
  month: string | null,
  chartSales: ChartRow[],
  chartPurchases: ChartRow[]
) {
  const salesMap = Object.fromEntries(
    chartSales.map((s) => [s.period, { total: Number(s.total), count: Number(s.count) }])
  )
  const purchasesMap = Object.fromEntries(
    chartPurchases.map((p) => [p.period, { total: Number(p.total), count: Number(p.count) }])
  )

  if (chartType === 'daily' && month) {
    const monthNum = parseInt(month, 10)
    return getDaysInMonth(year, monthNum).map((key) => ({
      key,
      label: formatDayLabel(key),
      sales: salesMap[key]?.total ?? 0,
      purchases: purchasesMap[key]?.total ?? 0,
      salesCount: salesMap[key]?.count ?? 0,
      purchasesCount: purchasesMap[key]?.count ?? 0,
    }))
  }

  return getYearMonthKeys(year).map((key) => ({
    key,
    label: formatMonthLabel(key),
    sales: salesMap[key]?.total ?? 0,
    purchases: purchasesMap[key]?.total ?? 0,
    salesCount: salesMap[key]?.count ?? 0,
    purchasesCount: purchasesMap[key]?.count ?? 0,
  }))
}

function getYearOptions() {
  const current = new Date().getFullYear()
  const years: number[] = []
  for (let y = current; y >= current - 5; y--) years.push(y)
  return years
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState('ALL')

  const isFirstLoad = useRef(true)

  const fetchDashboard = useCallback(async (selectedYear: string, selectedMonth: string) => {
    if (isFirstLoad.current) setLoading(true)
    else setChartLoading(true)
    try {
      const params = new URLSearchParams({ year: selectedYear })
      if (selectedMonth !== 'ALL') params.set('month', selectedMonth)
      const res = await fetch(`/api/dashboard?${params}`)
      const data = await res.json()
      setStats(data)
    } finally {
      if (isFirstLoad.current) {
        setLoading(false)
        isFirstLoad.current = false
      } else {
        setChartLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchDashboard(year, month)
  }, [year, month, fetchDashboard])

  if (loading || !stats) {
    return <DashboardPageSkeleton />
  }

  const chartData = buildChartData(
    stats.chartType,
    stats.chartYear,
    stats.chartMonth,
    stats.chartSales,
    stats.chartPurchases
  )

  const periodLabel =
    month !== 'ALL'
      ? `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
      : `Year ${year}`

  const xLabel = stats.chartType === 'daily' ? 'Day' : 'Month'
  const isMonthView = month !== 'ALL'

  const monthTotals = isMonthView
    ? chartData.reduce(
        (acc, row) => ({
          sales: acc.sales + row.sales,
          purchases: acc.purchases + row.purchases,
          salesCount: acc.salesCount + row.salesCount,
          purchasesCount: acc.purchasesCount + row.purchasesCount,
        }),
        { sales: 0, purchases: 0, salesCount: 0, purchasesCount: 0 }
      )
    : null

  const handleChartClick = (state: { activePayload?: { payload?: { key?: string } }[] }) => {
    if (month !== 'ALL' || stats.chartType !== 'monthly') return
    const key = state?.activePayload?.[0]?.payload?.key
    if (!key) return
    const monthPart = key.split('-')[1]
    if (monthPart) setMonth(monthPart)
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Business overview for today</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Sales Today"
          value={formatCurrency(stats.salesToday.amount)}
          sub={`${stats.salesToday.count} invoice(s)`}
          icon={TrendingUp}
          color="bg-blue-500"
          href="/billing"
        />
        <StatCard
          title="Purchases Today"
          value={formatCurrency(stats.purchasesToday.amount)}
          sub={`${stats.purchasesToday.count} bill(s)`}
          icon={ShoppingCart}
          color="bg-purple-500"
          href="/purchases"
        />
        <StatCard
          title="Pending Quotations"
          value={String(stats.pendingQuotations)}
          icon={FileText}
          color="bg-teal-500"
          href="/quotations"
        />
        <StatCard
          title="Low Stock Items"
          value={String(stats.lowStockCount)}
          icon={AlertTriangle}
          color="bg-yellow-500"
          href="/inventory"
        />
      </div>

      <div className="relative">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        <Card>
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Sales vs Purchases ({periodLabel})
              </CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-9 w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getYearOptions().map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Months</SelectItem>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1).padStart(2, '0')}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {isMonthView && monthTotals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg border bg-blue-50/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="font-semibold text-blue-700">{formatCurrency(monthTotals.sales)}</p>
                  <p className="text-xs text-muted-foreground">{monthTotals.salesCount} invoice(s)</p>
                </div>
                <div className="rounded-lg border bg-purple-50/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Purchases</p>
                  <p className="font-semibold text-purple-700">{formatCurrency(monthTotals.purchases)}</p>
                  <p className="text-xs text-muted-foreground">{monthTotals.purchasesCount} bill(s)</p>
                </div>
              </div>
            )}
            {!isMonthView && (
              <p className="text-xs text-muted-foreground">
                Select a month from the dropdown, or click a month on the chart for day-wise data.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <SalesPurchasesChart
              data={chartData}
              chartType={stats.chartType}
              month={month}
              xLabel={xLabel}
              onChartClick={handleChartClick}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
