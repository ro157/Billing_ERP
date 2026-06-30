'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentPdfViewer } from '@/components/shared/document-pdf-viewer'
import { useToast } from '@/hooks/use-toast'
import { usePageCount } from '@/hooks/use-page-count'
import {
  Eye,
  Edit,
  Trash2,
  ShoppingCart,
  Calendar,
} from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { ListPageToolbar } from '@/components/shared/list-page-toolbar'
import { parseJsonResponse } from '@/lib/fetch-json'

interface Purchase {
  id: string
  purchase_no: string
  date: string
  vendor_name: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  status: string
  payment_mode?: string | null
  notes?: string | null
  bill_no?: string | null
  gst_type?: string
}

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PARTIAL: 'secondary',
  PAID: 'default',
  CANCELLED: 'destructive',
  DRAFT: 'secondary',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_COLORS[status] || 'secondary'}>{status}</Badge>
  )
}

function PurchaseActions({
  purchaseId,
  onView,
  onDelete,
  compact = false,
}: {
  purchaseId: string
  onView: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const size = compact ? 'h-7 w-7' : 'h-8 w-8'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className="inline-flex items-center justify-center gap-0">
      <Button variant="ghost" size="icon" title="View PDF" className={size} onClick={onView}>
        <Eye className={icon} />
      </Button>
      <Link href={`/purchases/${purchaseId}/edit`}>
        <Button variant="ghost" size="icon" title="Edit" className={size}>
          <Edit className={icon} />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        title="Delete"
        className={cn(size, 'text-destructive hover:text-destructive')}
        onClick={onDelete}
      >
        <Trash2 className={icon} />
      </Button>
    </div>
  )
}

export default function PurchasesPage() {
  const { toast } = useToast()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  usePageCount(`${total} purchase invoice(s)`)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const [pdfViewerTitle, setPdfViewerTitle] = useState('')
  const [pdfViewerFilename, setPdfViewerFilename] = useState('purchase.pdf')

  const showTable = viewMode === 'table' && !isMobile
  const showCards = viewMode === 'card' || isMobile

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.trim()) params.set('search', search.trim())
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      const res = await fetch(`/api/purchases?${params}`)
      const data = await parseJsonResponse<{ purchases?: Purchase[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load purchases', variant: 'destructive' })
        return
      }
      setPurchases(data.purchases || [])
      setTotal(Number(data.total) || 0)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load purchases'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, fromDate, toDate, page, toast])

  useEffect(() => {
    fetchPurchases()
  }, [fetchPurchases])

  const handleView = (p: Purchase) => {
    const safeName = p.purchase_no.replace(/[/\\?%*:|"<>]/g, '-')
    setPdfViewerTitle(p.purchase_no)
    setPdfViewerFilename(`${safeName}.pdf`)
    setPdfViewerUrl(`/api/purchases/${p.id}/pdf`)
    setPdfViewerOpen(true)
  }

  const handleDelete = async (id: string, purchaseNo: string) => {
    if (!confirm(`Delete purchase "${purchaseNo}"? Stock will be reversed.`)) return
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Purchase deleted' })
      fetchPurchases()
    } else {
      const err = await res.json()
      toast({ title: 'Error', description: err.error || 'Cannot delete', variant: 'destructive' })
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

  const renderCardGrid = () => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 p-3 sm:p-4">
      {purchases.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border bg-card shadow-sm overflow-hidden"
        >
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-snug">{p.purchase_no}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{p.vendor_name}</p>
                </div>
              </div>
              <PurchaseActions
                compact
                purchaseId={p.id}
                onView={() => handleView(p)}
                onDelete={() => handleDelete(p.id, p.purchase_no)}
              />
            </div>

            <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground">Date</span>
                <span className="font-medium text-sm">{formatDate(p.date)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="font-semibold text-sm text-primary">{formatCurrency(p.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-muted-foreground shrink-0">Status</span>
            <span className="ml-auto">
              <StatusBadge status={p.status} />
            </span>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <ListPageToolbar
        searchPlaceholder="Vendor or purchase no..."
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        addLabel="New Purchase"
        addHref="/purchases/new"
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

      <Card className="overflow-hidden">
        {loading ? (
          <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
        ) : purchases.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">No purchases found</CardContent>
        ) : showTable ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase No</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center w-[132px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium whitespace-nowrap">{p.purchase_no}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{p.vendor_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.date)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {formatCurrency(p.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <PurchaseActions
                        purchaseId={p.id}
                        onView={() => handleView(p)}
                        onDelete={() => handleDelete(p.id, p.purchase_no)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          renderCardGrid()
        )}

        <Pagination />
      </Card>

      <DocumentPdfViewer
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfApiUrl={pdfViewerUrl}
        title={pdfViewerTitle}
        filename={pdfViewerFilename}
      />
    </div>
  )
}
