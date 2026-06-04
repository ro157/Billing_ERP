'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Eye, Edit, Trash2, LayoutGrid, Table2, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Quotation {
  id: string
  quotation_no: string
  date: string
  valid_until?: string
  customer_name: string
  total_amount: number
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'secondary',
  SENT: 'default',
  ACCEPTED: 'default',
  REJECTED: 'destructive',
  CONVERTED: 'secondary',
  EXPIRED: 'outline',
}

function QuotationActions({
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
      <Link href={`/quotations/${id}`}>
        <Button variant="ghost" size="icon" title="View" className={size}>
          <Eye className={icon} />
        </Button>
      </Link>
      <Link href={`/quotations/${id}/edit`}>
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_COLORS[status] as 'secondary' | 'default' | 'destructive' | 'outline' || 'secondary'}>
      {status}
    </Badge>
  )
}

export default function QuotationsPage() {
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
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

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await fetch(`/api/quotations?${params}`)
      const data = await res.json()
      setQuotations(data.quotations || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  const handleDelete = async (id: string, quotationNo: string) => {
    if (!confirm(`Delete quotation "${quotationNo}"?`)) return
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Quotation deleted' })
      fetchQuotations()
    } else {
      const e = await res.json()
      toast({ title: e.error || 'Error', variant: 'destructive' })
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Quotations</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{total} quotation(s)</p>
        </div>
        <Link href="/quotations/new" className="w-full sm:w-auto">
          <Button className="h-9 w-full sm:w-auto">
            <Plus className="w-4 h-4 shrink-0 mr-1.5" />
            <span className="text-sm">New Quotation</span>
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search quotations..."
            className="pl-9 h-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36 h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="CONVERTED">Converted</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden md:flex items-center gap-1 rounded-md border bg-background p-1 shrink-0">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'outline'}
            size="icon"
            className="h-8 w-8"
            title="Table view"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'outline'}
            size="icon"
            className="h-8 w-8"
            title="Card view"
            onClick={() => setViewMode('card')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showTable && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No quotations found
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.quotation_no}</TableCell>
                    <TableCell>{q.customer_name}</TableCell>
                    <TableCell>{formatDate(q.date)}</TableCell>
                    <TableCell>{q.valid_until ? formatDate(q.valid_until) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.total_amount)}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell className="text-right">
                      <QuotationActions id={q.id} onDelete={() => handleDelete(q.id, q.quotation_no)} />
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
          ) : quotations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No quotations found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {quotations.map((q) => (
                <Card key={q.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug">{q.quotation_no}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">{q.customer_name}</p>
                          </div>
                        </div>
                        <QuotationActions
                          compact
                          id={q.id}
                          onDelete={() => handleDelete(q.id, q.quotation_no)}
                        />
                      </div>

                      <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Date</span>
                          <span className="font-medium text-sm">{formatDate(q.date)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Valid Until</span>
                          <span className="font-medium text-sm">
                            {q.valid_until ? formatDate(q.valid_until) : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Amount</span>
                          <span className="font-semibold text-sm text-primary">{formatCurrency(q.total_amount)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2.5 rounded-b-xl">
                      <span className="text-xs text-muted-foreground shrink-0">Status</span>
                      <span className="ml-auto">
                        <StatusBadge status={q.status} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {total > 20 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          )}
        </div>
      )}
    </div>
  )
}
