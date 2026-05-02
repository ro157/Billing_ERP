'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { challanSchema, type ChallanInput } from '@/lib/validations'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Product { id: string; name: string }
interface Customer { id: string; name: string }

export default function NewDeliveryChallanPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const { register, control, handleSubmit, watch, setValue } = useForm<ChallanInput>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      items: [{ productId: '', description: '', quantity: 1, rate: 0, unit: '' }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  useEffect(() => {
    fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(d.products || []))
    fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers || []))
  }, [])

  const selectProduct = (index: number, productId: string) => {
    const p = products.find(p => p.id === productId)
    if (!p) return
    setValue(`items.${index}.productId`, productId)
    setValue(`items.${index}.description`, p.name)
  }

  const onSubmit = async (data: ChallanInput) => {
    setSaving(true)
    try {
      const res = await fetch('/api/delivery-challans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }
      toast({ title: 'Delivery challan created' })
      router.push('/delivery-challans')
    } catch (e: any) {
      toast({ title: e.message || 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/delivery-challans"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Delivery Challan</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Challan Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select onValueChange={(v) => setValue('customerId', v)}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" {...register('date')} />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input {...register('vehicleNo')} placeholder="MH12AB1234" />
            </div>
            <div className="space-y-2">
              <Label>Driver Name</Label>
              <Input {...register('driverName')} />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input {...register('destination')} />
            </div>
            <div className="space-y-2">
              <Label>E-Way Bill Number</Label>
              <Input {...register('eWayBillNo')} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Input {...register('notes')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', description: '', quantity: 1, rate: 0, gstRate: 0, unit: '' })}>
              <Plus className="w-4 h-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Product</TableHead><TableHead>Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead><TableHead className="w-24">Unit</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, i) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Select onValueChange={(v) => selectProduct(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input {...register(`items.${i}.description`)} /></TableCell>
                    <TableCell><Input type="number" min="0.001" step="0.001" {...register(`items.${i}.quantity`, { valueAsNumber: true })} /></TableCell>
                    <TableCell><Input {...register(`items.${i}.unit`)} placeholder="Nos" /></TableCell>
                    <TableCell>{fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-4 h-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/delivery-challans"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Challan'}</Button>
        </div>
      </form>
    </div>
  )
}
