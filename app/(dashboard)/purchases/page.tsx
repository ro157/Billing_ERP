'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Purchase {
  id: string; purchase_no: string; date: string
  vendor_name: string; total_amount: number; paid_amount: number; balance_amount: number; status: string
}

export default function PurchasesPage() {
  const { toast } = useToast()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/purchases?${params}`)
    const data = await res.json()
    setPurchases(data.purchases)
    setTotal(data.total)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchPurchases() }, [fetchPurchases])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Purchases</h1><p className="text-muted-foreground">{total} purchase(s)</p></div>
        <Link href="/purchases/new"><Button><Plus className="w-4 h-4 mr-2" />New Purchase</Button></Link>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search purchases..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase No</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No purchases found</TableCell></TableRow>
            ) : purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.purchase_no}</TableCell>
                <TableCell>{p.vendor_name}</TableCell>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(p.total_amount)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(p.paid_amount)}</TableCell>
                <TableCell className="text-right text-orange-600">{formatCurrency(p.balance_amount)}</TableCell>
                <TableCell><Badge variant={p.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link href={`/purchases/${p.id}`}><Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 20 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
