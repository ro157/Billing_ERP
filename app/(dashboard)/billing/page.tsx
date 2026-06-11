'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { Eye, Edit, Trash2, FileText, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ListPageToolbar } from '@/components/shared/list-page-toolbar'
import { parseJsonResponse } from '@/lib/fetch-json'

interface Invoice {
  id: string
  invoice_no: string
  date: string
  due_date?: string
  customer_name: string
  total_amount: number
}

function InvoiceActions({
  id,
  onDelete,
  compact = false,
}: {
  id: string
  onDelete: () => void
  compact?: boolean
}) {
  const size = compact ? 'h-7 w-7' : 'h-8 w-8'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className="flex items-center justify-end gap-0 shrink-0">
      <Link href={`/billing/${id}`}>
        <Button variant="ghost" size="icon" title="View" className={size}>
          <Eye className={icon} />
        </Button>
      </Link>
      <Link href={`/billing/${id}/edit`}>
        <Button variant="ghost" size="icon" title="Edit" className={size}>
          <Edit className={icon} />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        title="Delete"
        className={`${size} text-destructive hover:text-destructive`}
        onClick={onDelete}
      >
        <Trash2 className={icon} />
      </Button>
    </div>
  )
}

export default function BillingPage() {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)

  const showTable = viewMode === 'table' && !isMobile
  const showCards = viewMode === 'card' || isMobile

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.trim()) params.set('search', search.trim())
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      const res = await fetch(`/api/invoices?${params}`)
      const data = await parseJsonResponse<{ invoices?: Invoice[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load invoices', variant: 'destructive' })
        return
      }
      setInvoices(data.invoices || [])
      setTotal(Number(data.total) || 0)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load invoices'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, fromDate, toDate, page])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const handleDelete = async (id: string, invoiceNo: string) => {
    if (!confirm(`Delete invoice "${invoiceNo}"? Stock will be restored.`)) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Invoice deleted' })
      fetchInvoices()
    } else {
      const e = await res.json().catch(() => ({}))
      toast({ title: e.error || 'Failed to delete', variant: 'destructive' })
    }
  }

  const Pagination = () =>
    total > 20 ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-t">
        <p className="text-sm text-muted-foreground">
          Page {page} of {Math.ceil(total / 20)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    ) : null

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-2xl font-bold truncate">Sales Invoices</h1>
        <p className="text-xs sm:text-base text-muted-foreground">{total} invoice(s)</p>
      </div>

      <ListPageToolbar
        searchPlaceholder="Company or invoice no..."
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        addLabel="New Invoice"
        addHref="/billing/new"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="h-9 w-full min-w-0 pr-9 text-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="h-9 w-full min-w-0 pr-9 text-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  min={fromDate || undefined}
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPage(1) }}
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 flex items-end min-w-0">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full min-w-0 px-2 sm:px-4"
                onClick={() => {
                  setSearch('')
                  setFromDate('')
                  setToDate('')
                  setPage(1)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTable && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell>{inv.due_date ? formatDate(inv.due_date) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      <InvoiceActions id={inv.id} onDelete={() => handleDelete(inv.id, inv.invoice_no)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination />
        </Card>
      )}

      {showCards && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No invoices found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {invoices.map((inv) => (
                <Card key={inv.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug">{inv.invoice_no}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">{inv.customer_name}</p>
                          </div>
                        </div>
                        <InvoiceActions
                          compact
                          id={inv.id}
                          onDelete={() => handleDelete(inv.id, inv.invoice_no)}
                        />
                      </div>

                      <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Date</span>
                          <span className="font-medium text-sm">{formatDate(inv.date)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Due Date</span>
                          <span className="font-medium text-sm">
                            {inv.due_date ? formatDate(inv.due_date) : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Amount</span>
                          <span className="font-semibold text-sm text-primary">{formatCurrency(inv.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {total > 20 && (
            <Card>
              <Pagination />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
