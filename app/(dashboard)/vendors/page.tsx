'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vendorSchema, VendorInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Edit, Truck } from 'lucide-react'

interface Vendor {
  id: string; name: string; email?: string; phone?: string; gstin?: string; city?: string; state?: string
}

export default function VendorsPage() {
  const { toast } = useToast()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<VendorInput>({ resolver: zodResolver(vendorSchema), defaultValues: { name: '' } })

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/vendors?${params}`)
    const data = await res.json()
    setVendors(data.vendors)
    setTotal(data.total)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const openNew = () => { setEditing(null); form.reset({ name: '' }); setDialogOpen(true) }
  const openEdit = (v: Vendor) => { setEditing(v); form.reset(v as any); setDialogOpen(true) }

  const onSubmit = async (data: VendorInput) => {
    setSaving(true)
    try {
      const url = editing ? `/api/vendors/${editing.id}` : '/api/vendors'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      toast({ title: editing ? 'Vendor updated' : 'Vendor created' })
      setDialogOpen(false)
      fetchVendors()
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Vendors</h1><p className="text-muted-foreground">{total} vendor(s)</p></div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Vendor</Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
              <TableHead>GSTIN</TableHead><TableHead>City / State</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : vendors.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No vendors found</TableCell></TableRow>
            ) : vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-purple-600" />
                    </div>
                    {v.name}
                  </div>
                </TableCell>
                <TableCell>{v.phone || '-'}</TableCell>
                <TableCell>{v.email || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{v.gstin || '-'}</TableCell>
                <TableCell>{[v.city, v.state].filter(Boolean).join(', ') || '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Edit className="w-4 h-4" /></Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label>Name *</Label><Input {...form.register('name')} />
                {form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2"><Label>Phone</Label><Input {...form.register('phone')} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" {...form.register('email')} /></div>
              <div className="space-y-2"><Label>GSTIN</Label><Input {...form.register('gstin')} /></div>
              <div className="space-y-2"><Label>Pincode</Label><Input {...form.register('pincode')} /></div>
              <div className="col-span-2 space-y-2"><Label>Address</Label><Input {...form.register('address')} /></div>
              <div className="space-y-2"><Label>City</Label><Input {...form.register('city')} /></div>
              <div className="space-y-2"><Label>State</Label><Input {...form.register('state')} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
