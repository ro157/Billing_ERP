'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { usePageCount } from '@/hooks/use-page-count'
import { ListPageToolbar } from '@/components/shared/list-page-toolbar'
import { DocumentPdfViewer } from '@/components/shared/document-pdf-viewer'
import { Eye, Edit, Trash2, Package } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

interface Challan {
  id: string
  challan_no: string
  date: string
  customer_name: string
}

function ChallanActions({
  id,
  onView,
  onDelete,
  compact = false,
  align = 'end',
}: {
  id: string
  onView: () => void
  onDelete: () => void
  compact?: boolean
  align?: 'center' | 'end'
}) {
  const size = compact ? 'h-7 w-7' : 'h-8 w-8'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div
      className={cn(
        'flex items-center gap-0 shrink-0',
        align === 'center' ? 'justify-center w-full' : 'justify-end'
      )}
    >
      <Button variant="ghost" size="icon" title="View PDF" className={size} onClick={onView}>
        <Eye className={icon} />
      </Button>
      <Link href={`/delivery-challans/${id}/edit`}>
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

export default function DeliveryChallansPage() {
  const { toast } = useToast()
  const [challans, setChallans] = useState<Challan[]>([])
  const [total, setTotal] = useState(0)
  usePageCount(`${total} challan(s)`)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const [pdfViewerTitle, setPdfViewerTitle] = useState('')
  const [pdfViewerFilename, setPdfViewerFilename] = useState('delivery-challan.pdf')

  const showTable = viewMode === 'table' && !isMobile
  const showCards = viewMode === 'card' || isMobile

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const fetchChallans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/delivery-challans?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load challans', variant: 'destructive' })
        return
      }
      setChallans(data.challans || [])
      setTotal(Number(data.total) || 0)
    } catch {
      toast({ title: 'Failed to load challans', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, page, toast])

  useEffect(() => { fetchChallans() }, [fetchChallans])

  const handleView = (c: Challan) => {
    const safeName = c.challan_no.replace(/[/\\?%*:|"<>]/g, '-')
    setPdfViewerTitle(c.challan_no)
    setPdfViewerFilename(`${safeName}.pdf`)
    setPdfViewerUrl(`/api/delivery-challans/${c.id}/pdf`)
    setPdfViewerOpen(true)
  }

  const handleDelete = async (id: string, challanNo: string) => {
    if (!confirm(`Delete challan "${challanNo}"?`)) return
    const res = await fetch(`/api/delivery-challans/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Challan deleted' })
      fetchChallans()
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
      <ListPageToolbar
        searchPlaceholder="Search challans..."
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        addLabel="New Challan"
        addHref="/delivery-challans/new"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {showTable && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challan No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[7.5rem] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : challans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No challans found
                  </TableCell>
                </TableRow>
              ) : (
                challans.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.challan_no}</TableCell>
                    <TableCell>{c.customer_name}</TableCell>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell className="w-[7.5rem]">
                      <ChallanActions
                        align="center"
                        id={c.id}
                        onView={() => handleView(c)}
                        onDelete={() => handleDelete(c.id, c.challan_no)}
                      />
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
          ) : challans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No challans found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {challans.map((c) => (
                <Card key={c.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug">{c.challan_no}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">{c.customer_name}</p>
                          </div>
                        </div>
                        <ChallanActions
                          compact
                          id={c.id}
                          onView={() => handleView(c)}
                          onDelete={() => handleDelete(c.id, c.challan_no)}
                        />
                      </div>
                      <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Date</span>
                          <span className="font-medium text-sm">{formatDate(c.date)}</span>
                        </div>
                      </div>
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
