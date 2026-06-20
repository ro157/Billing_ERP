'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PO {
  id: string; po_no: string; date: string; expected_date?: string
  vendor_name: string; total_amount: number; status: string
}

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const fetchPos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const res = await fetch(`/api/purchase-orders?${params}`)
    const data = await res.json()
    setPos(data.purchaseOrders)
    setTotal(data.total)
    setLoading(false)
  }, [search, status, page])

  useEffect(() => { fetchPos() }, [fetchPos])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-muted-foreground">{total} PO(s)</p></div>
        <Link href="/purchase-orders/new"><Button><Plus className="w-4 h-4 mr-2" />New PO</Button></Link>
      </div>

      <Card><CardContent className="p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search POs..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem><SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem><SelectItem value="RECEIVED">Received</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO No</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead>
              <TableHead>Expected</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : pos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No purchase orders found</TableCell></TableRow>
            ) : pos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.po_no}</TableCell>
                <TableCell>{p.vendor_name}</TableCell>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>{p.expected_date ? formatDate(p.expected_date) : '-'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(p.total_amount)}</TableCell>
                <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link href={`/purchase-orders/${p.id}`}><Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
