'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

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

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales-summary')
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType, from, to })
      const res = await fetch(`/api/reports?${params}`)
      const result = await res.json()
      setData(Array.isArray(result) ? result : [])
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const ws = utils.json_to_sheet(data.map((row: any) => {
      if (reportType === 'sales-summary') {
        return {
          'Invoice No': row.invoiceNo,
          'Customer': row.customer?.name,
          'Date': formatDate(row.date),
          'Total': Number(row.totalAmount),
          'Paid': Number(row.paidAmount),
          'Balance': Number(row.balanceAmount),
          'Status': row.status,
        }
      }
      if (reportType === 'purchase-summary') {
        return {
          'Purchase No': row.purchaseNo,
          'Vendor': row.vendor?.name,
          'Date': formatDate(row.date),
          'Total': Number(row.totalAmount),
          'Paid': Number(row.paidAmount),
          'Balance': Number(row.balanceAmount),
          'Status': row.status,
        }
      }
      if (reportType === 'stock-report' || reportType === 'low-stock') {
        return {
          'Product': row.name,
          'SKU': row.sku,
          'HSN': row.hsnCode,
          'Category': row.category?.name,
          'Unit': row.unit?.shortName,
          'Stock': row.currentStock,
          'Sale Price': Number(row.salePrice),
          'Purchase Price': Number(row.purchasePrice),
        }
      }
      return row
    }))
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Report')
    writeFile(wb, `${reportType}-${from}-${to}.xlsx`)
  }

  const renderTable = () => {
    if (data.length === 0) return (
      <div className="text-center py-16 text-muted-foreground">
        Run the report to see results
      </div>
    )

    if (reportType === 'sales-summary' || reportType === 'gst-sales') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {reportType === 'gst-sales' && <>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
              </>}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.invoiceNo}</TableCell>
                <TableCell>{row.customer?.name}</TableCell>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalAmount)}</TableCell>
                {reportType === 'gst-sales' && <>
                  <TableCell className="text-right">{formatCurrency(row.cgstAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.sgstAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.igstAmount)}</TableCell>
                </>}
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
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
              <TableHead>Status</TableHead>
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
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
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
              <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
              <TableHead>Unit</TableHead><TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.sku || '-'}</TableCell>
                <TableCell>{row.category?.name || '-'}</TableCell>
                <TableCell>{row.unit?.shortName || '-'}</TableCell>
                <TableCell className="text-right">
                  <span className={row.currentStock <= 10 ? 'text-orange-600 font-medium' : ''}>{row.currentStock}</span>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(row.salePrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Generate and export business reports</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Report Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 w-48">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!['stock-report', 'low-stock'].includes(reportType) && (
              <>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <Button onClick={fetchReport} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />{loading ? 'Loading...' : 'Run Report'}
            </Button>
            {data.length > 0 && (
              <Button variant="outline" onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel
              </Button>
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
