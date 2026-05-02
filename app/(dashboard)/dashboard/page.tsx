'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, FileText, Package,
  AlertTriangle, Clock, IndianRupee
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface DashboardStats {
  salesToday: { amount: number; count: number }
  purchasesToday: { amount: number; count: number }
  customerDues: { amount: number; count: number }
  vendorDues: { amount: number; count: number }
  pendingQuotations: number
  openPOs: number
  lowStockCount: number
  monthlySales: { month: string; total: number; count: number }[]
  monthlyPurchases: { month: string; total: number; count: number }[]
  gstSummary: { cgst: number; sgst: number; igst: number; total: number }
}

function StatCard({
  title, value, sub, icon: Icon, color, badge,
}: {
  title: string; value: string; sub?: string; icon: any; color: string; badge?: string
}) {
  return (
    <Card>
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
  )
}

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleString('default', { month: 'short' })
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!stats) return null

  const chartData = (() => {
    const months: Record<string, { month: string; sales: number; purchases: number }> = {}
    stats.monthlySales.forEach((s) => {
      if (!months[s.month]) months[s.month] = { month: formatMonth(s.month), sales: 0, purchases: 0 }
      months[s.month].sales = Number(s.total)
    })
    stats.monthlyPurchases.forEach((p) => {
      if (!months[p.month]) months[p.month] = { month: formatMonth(p.month), sales: 0, purchases: 0 }
      months[p.month].purchases = Number(p.total)
    })
    return Object.values(months).slice(-6)
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Business overview for today</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sales Today"
          value={formatCurrency(stats.salesToday.amount)}
          sub={`${stats.salesToday.count} invoice(s)`}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Purchases Today"
          value={formatCurrency(stats.purchasesToday.amount)}
          sub={`${stats.purchasesToday.count} bill(s)`}
          icon={ShoppingCart}
          color="bg-purple-500"
        />
        <StatCard
          title="Customer Dues"
          value={formatCurrency(stats.customerDues.amount)}
          sub={`${stats.customerDues.count} pending`}
          icon={IndianRupee}
          color="bg-orange-500"
          badge="Receivable"
        />
        <StatCard
          title="Vendor Dues"
          value={formatCurrency(stats.vendorDues.amount)}
          sub={`${stats.vendorDues.count} pending`}
          icon={TrendingDown}
          color="bg-red-500"
          badge="Payable"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Quotations"
          value={String(stats.pendingQuotations)}
          icon={FileText}
          color="bg-teal-500"
        />
        <StatCard
          title="Open Purchase Orders"
          value={String(stats.openPOs)}
          icon={Clock}
          color="bg-indigo-500"
        />
        <StatCard
          title="Low Stock Items"
          value={String(stats.lowStockCount)}
          icon={AlertTriangle}
          color="bg-yellow-500"
        />
        <StatCard
          title="GST Payable (Month)"
          value={formatCurrency(stats.gstSummary.total)}
          sub={`CGST: ${formatCurrency(stats.gstSummary.cgst)} | SGST: ${formatCurrency(stats.gstSummary.sgst)}`}
          icon={Package}
          color="bg-green-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales vs Purchases (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" fill="url(#sales)" />
                <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#a855f7" fill="url(#purchases)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
