'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export type DashboardChartRow = {
  key: string
  label: string
  sales: number
  purchases: number
  salesCount: number
  purchasesCount: number
}

interface SalesPurchasesChartProps {
  data: DashboardChartRow[]
  chartType: 'monthly' | 'daily'
  month: string
  xLabel: string
  onChartClick?: (state: { activePayload?: { payload?: { key?: string } }[] }) => void
}

export function SalesPurchasesChart({
  data,
  chartType,
  month,
  xLabel,
  onChartClick,
}: SalesPurchasesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        onClick={onChartClick}
        style={{ cursor: month === 'ALL' ? 'pointer' : 'default' }}
      >
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
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={chartType === 'daily' ? 2 : 0}
          angle={chartType === 'daily' ? -45 : -20}
          textAnchor="end"
          height={55}
        />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number, name: string, item: { payload?: { salesCount?: number; purchasesCount?: number } }) => {
            const count = name === 'Sales' ? item.payload?.salesCount : item.payload?.purchasesCount
            return [`${formatCurrency(v)}${count != null ? ` (${count} txn)` : ''}`, name]
          }}
          labelFormatter={(label) => `${xLabel}: ${label}`}
        />
        <Legend />
        <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" fill="url(#sales)" />
        <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#a855f7" fill="url(#purchases)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
