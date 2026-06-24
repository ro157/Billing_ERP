'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileSpreadsheet, Search } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { usePageCount } from '@/hooks/use-page-count'
import { useToast } from '@/hooks/use-toast'

const REPORT_TYPES = [
  { value: 'sales-summary', label: 'Sales Summary' },
  { value: 'purchase-summary', label: 'Purchase Summary' },
  { value: 'gst-sales', label: 'GST Sales Register' },
  { value: 'gst-purchase', label: 'GST Purchase Register' },
  { value: 'stock-report', label: 'Stock Report' },
  { value: 'low-stock', label: 'Low Stock Report' },
  { value: 'customer-ledger', label: 'Customer Ledger' },
  { value: 'vendor-ledger', label: 'Vendor Ledger' },
]

const exportExcelWrapClass =
  'rounded-md bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-[2px] shadow-sm'

const exportExcelBtnClass = cn(
  'h-9 border-0 bg-background text-emerald-800 hover:bg-emerald-50',
  'dark:text-emerald-300 dark:hover:bg-emerald-950/40'
)

export default function ReportsPage() {
  usePageCount('Generate and export business reports')
  const { toast } = useToast()
  const [reportType, setReportType] = useState('sales-summary')
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const resetReportResults = () => {
    setData([])
    setSummary(null)
    setHasRun(false)
  }

  const handleReportTypeChange = (value: string) => {
    setReportType(value)
    resetReportResults()
  }

  const fetchReport = async () => {
    if (showDateRange && from && to && from > to) {
      toast({ title: 'From date cannot be after To date', variant: 'destructive' })
      return
    }

    setLoading(true)
    setHasRun(true)
    try {
      const params = new URLSearchParams({ type: reportType, from, to })
      const res = await fetch(`/api/reports?${params}`)
      const result = await res.json()
      if (!res.ok) {
        toast({ title: result.error || 'Failed to load report', variant: 'destructive' })
        setData([])
        setSummary(null)
        return
      }
      setData(Array.isArray(result.data) ? result.data : [])
      setSummary(result.summary ?? null)
    } catch {
      toast({ title: 'Failed to load report', variant: 'destructive' })
      setData([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const ws = utils.json_to_sheet(data.map((row: any) => {
      if (reportType === 'sales-summary') {
        return {
          Date: formatDate(row.date),
          'Invoice Number': row.invoiceNo,
          'Customer Name': row.customerName || row.customer?.name,
          Amount: Number(row.totalAmount),
        }
      }
      if (reportType === 'gst-sales') {
        return {
          'Invoice No': row.invoiceNo,
          Customer: row.customer?.name,
          Date: formatDate(row.date),
          Total: Number(row.totalAmount),
          CGST: Number(row.cgstAmount),
          SGST: Number(row.sgstAmount),
          IGST: Number(row.igstAmount),
        }
      }
      if (reportType === 'purchase-summary' || reportType === 'gst-purchase') {
        return {
          'Purchase No': row.purchaseNo,
          Vendor: row.vendor?.name,
          Date: formatDate(row.date),
          Total: Number(row.totalAmount),
          Paid: Number(row.paidAmount),
          Balance: Number(row.balanceAmount),
          ...(reportType === 'gst-purchase'
            ? {
                CGST: Number(row.cgstAmount),
                SGST: Number(row.sgstAmount),
                IGST: Number(row.igstAmount),
              }
            : {}),
        }
      }
      if (reportType === 'stock-report' || reportType === 'low-stock') {
        return {
          Product: row.name,
          Description: row.description || '-',
          HSN: row.hsn,
          Stock: Number(row.currentStock),
        }
      }
      return row
    }))
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Report')
    writeFile(wb, `${reportType}-${from}-${to}.xlsx`)
  }

  const showDateRange = !['stock-report', 'low-stock'].includes(reportType)

  const renderTable = () => {
    if (loading) {
      return <div className="text-center py-16 text-muted-foreground">Loading report...</div>
    }
    if (!hasRun) {
      return <div className="text-center py-16 text-muted-foreground">Run the report to see results</div>
    }
    if (data.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          {reportType === 'customer-ledger' || reportType === 'vendor-ledger'
            ? 'Ledger report coming soon'
            : 'No records found for the selected filters'}
        </div>
      )
    }

    if (reportType === 'sales-summary') {
      const totalAmount = Number(summary?.total_sales) || data.reduce((s, r) => s + Number(r.totalAmount || 0), 0)
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell className="font-medium">{row.invoiceNo}</TableCell>
                <TableCell>{row.customerName || row.customer?.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalAmount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell colSpan={3} className="text-right">
                Total ({data.length} invoice{data.length === 1 ? '' : 's'})
              </TableCell>
              <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )
    }

    if (reportType === 'gst-sales') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.invoiceNo}</TableCell>
                <TableCell>{row.customer?.name}</TableCell>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.cgstAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.sgstAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.igstAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    if (reportType === 'purchase-summary' || reportType === 'gst-purchase') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase No</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {reportType === 'gst-purchase' && <>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
              </>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.purchaseNo}</TableCell>
                <TableCell>{row.vendor?.name}</TableCell>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalAmount)}</TableCell>
                {reportType === 'gst-purchase' && <>
                  <TableCell className="text-right">{formatCurrency(row.cgstAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.sgstAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igstAmount)}</TableCell>
                </>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }

    if (reportType === 'stock-report' || reportType === 'low-stock') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => {
              const lowAlert = Number(row.lowStockAlert ?? 10)
              const isLow = Number(row.currentStock) <= lowAlert
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-xs truncate" title={row.description}>
                    {row.description || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.hsn || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span className={isLow ? 'text-orange-600 font-medium' : ''}>
                      {row.currentStock}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )
    }

    return null
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile: dates → report type + run button */}
          <div className="flex flex-col gap-4 md:hidden">
            {showDateRange && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 min-w-0">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-full min-w-0"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-full min-w-0"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-2 min-w-0">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={handleReportTypeChange}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchReport} disabled={loading} className="h-9 w-full">
                <Search className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{loading ? 'Loading...' : 'Run Report'}</span>
              </Button>
            </div>
            {hasRun && data.length > 0 && (
              <div className={cn(exportExcelWrapClass, 'w-full')}>
                <Button variant="outline" onClick={exportExcel} className={cn(exportExcelBtnClass, 'w-full')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600 dark:text-emerald-400" />
                  Export Excel
                </Button>
              </div>
            )}
          </div>

          {/* Desktop: single row */}
          <div className="hidden md:flex md:flex-row md:items-end md:gap-3">
            <div className="space-y-2 flex-1 max-w-xs min-w-0">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={handleReportTypeChange}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showDateRange && (
              <>
                <div className="space-y-2 w-40">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-full"
                  />
                </div>
                <div className="space-y-2 w-40">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-full"
                  />
                </div>
              </>
            )}

            <Button onClick={fetchReport} disabled={loading} className="h-9 shrink-0">
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Run Report'}
            </Button>
            {hasRun && data.length > 0 && (
              <div className={exportExcelWrapClass}>
                <Button variant="outline" onClick={exportExcel} className={exportExcelBtnClass}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600 dark:text-emerald-400" />
                  Export Excel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {renderTable()}
        </CardContent>
      </Card>
    </div>
  )
}
