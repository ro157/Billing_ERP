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
import { Plus, Search, Eye, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Quotation {
  id: string; quotation_no: string; date: string; valid_until?: string
  customer_name: string; total_amount: number; status: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'secondary', SENT: 'default', ACCEPTED: 'default', REJECTED: 'destructive', CONVERTED: 'secondary', EXPIRED: 'outline',
}

export default function QuotationsPage() {
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const res = await fetch(`/api/quotations?${params}`)
    const data = await res.json()
    setQuotations(data.quotations)
    setTotal(data.total)
    setLoading(false)
  }, [search, status, page])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quotation?')) return
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Deleted' }); fetchQuotations() }
    else { const e = await res.json(); toast({ title: e.error || 'Error', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Quotations</h1><p className="text-muted-foreground">{total} quotation(s)</p></div>
        <Link href="/quotations/new"><Button><Plus className="w-4 h-4 mr-2" />New Quotation</Button></Link>
      </div>

      <Card><CardContent className="p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="CONVERTED">Converted</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation No</TableHead><TableHead>Customer</TableHead>
              <TableHead>Date</TableHead><TableHead>Valid Until</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : quotations.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No quotations found</TableCell></TableRow>
            ) : quotations.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.quotation_no}</TableCell>
                <TableCell>{q.customer_name}</TableCell>
                <TableCell>{formatDate(q.date)}</TableCell>
                <TableCell>{q.valid_until ? formatDate(q.valid_until) : '-'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(q.total_amount)}</TableCell>
                <TableCell><Badge variant={STATUS_COLORS[q.status] as any || 'secondary'}>{q.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/quotations/${q.id}`}><Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button></Link>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(q.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
