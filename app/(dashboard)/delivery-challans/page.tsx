'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Challan {
  id: string; challan_no: string; date: string; customer_name: string
  vehicle_no?: string; status: string
}

export default function DeliveryChallansPage() {
  const [challans, setChallans] = useState<Challan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchChallans = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/delivery-challans?${params}`)
    const data = await res.json()
    setChallans(data.challans)
    setTotal(data.total)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchChallans() }, [fetchChallans])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Delivery Challans</h1><p className="text-muted-foreground">{total} challan(s)</p></div>
        <Link href="/delivery-challans/new"><Button><Plus className="w-4 h-4 mr-2" />New Challan</Button></Link>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search challans..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Challan No</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : challans.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No challans found</TableCell></TableRow>
            ) : challans.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.challan_no}</TableCell>
                <TableCell>{c.customer_name}</TableCell>
                <TableCell>{formatDate(c.date)}</TableCell>
                <TableCell>{c.vehicle_no || '-'}</TableCell>
                <TableCell>{c.vehicle_no || '-'}</TableCell>
                <TableCell><Badge variant={c.status === 'CONVERTED' ? 'secondary' : 'default'}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link href={`/delivery-challans/${c.id}`}><Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
