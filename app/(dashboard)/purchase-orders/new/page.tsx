'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { purchaseOrderSchema, type PurchaseOrderInput } from '@/lib/validations'
import { calculateGST, calculateItemAmount, formatCurrency, GST_RATES } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Product { id: string; name: string; purchase_price: number; gst_rate: number }
interface Vendor { id: string; name: string }

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])

  const { register, control, handleSubmit, watch, setValue } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      gstType: 'CGST_SGST',
      items: [{ productId: '', description: '', quantity: 1, rate: 0, gstRate: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const gstType = watch('gstType')

  useEffect(() => {
    fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(d.products || []))
    fetch('/api/vendors?limit=200').then(r => r.json()).then(d => setVendors(d.vendors || []))
  }, [])

  const selectProduct = (index: number, productId: string) => {
    const p = products.find(p => p.id === productId)
    if (!p) return
    setValue(`items.${index}.productId`, productId)
    setValue(`items.${index}.rate`, p.purchase_price)
    setValue(`items.${index}.gstRate`, p.gst_rate)
    setValue(`items.${index}.description`, p.name)
  }

  const computeTotals = useCallback(() => {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0
    for (const item of watchedItems || []) {
      const amount = calculateItemAmount(item.quantity || 0, item.rate || 0, 0)
      const tax = calculateGST(amount, item.gstRate || 0, gstType || 'CGST_SGST')
      taxable += amount; cgst += tax.cgst || 0; sgst += tax.sgst || 0; igst += tax.igst || 0
    }
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst }
  }, [watchedItems, gstType])

  const totals = computeTotals()

  const onSubmit = async (data: PurchaseOrderInput) => {
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }
      toast({ title: 'Purchase order created' })
      router.push('/purchase-orders')
    } catch (e: any) {
      toast({ title: e.message || 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/purchase-orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Purchase Order</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select onValueChange={(v) => setValue('vendorId', v)}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" {...register('date')} />
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <Input type="date" {...register('expectedDate')} />
            </div>
            <div className="space-y-2">
              <Label>GST Type</Label>
              <Select defaultValue="CGST_SGST" onValueChange={(v) => setValue('gstType', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CGST_SGST">CGST + SGST</SelectItem>
                  <SelectItem value="IGST">IGST</SelectItem>
                  <SelectItem value="EXEMPT">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Optional notes..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', description: '', quantity: 1, rate: 0, discount: 0, gstRate: 0 })}>
              <Plus className="w-4 h-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Product</TableHead><TableHead>Description</TableHead>
                  <TableHead className="w-20">Qty</TableHead><TableHead className="w-24">Rate</TableHead>
                  <TableHead className="w-20">GST%</TableHead><TableHead className="w-24 text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, i) => {
                  const item = watchedItems?.[i]
                  const amount = calculateItemAmount(item?.quantity || 0, item?.rate || 0, 0)
                  const gst = calculateGST(amount, item?.gstRate || 0, gstType || 'CGST_SGST')
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Select onValueChange={(v) => selectProduct(i, v)}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input {...register(`items.${i}.description`)} /></TableCell>
                      <TableCell><Input type="number" min="1" {...register(`items.${i}.quantity`, { valueAsNumber: true })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" {...register(`items.${i}.rate`, { valueAsNumber: true })} /></TableCell>
                      <TableCell>
                        <Select defaultValue="0" onValueChange={(v) => setValue(`items.${i}.gstRate`, parseFloat(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(amount + gst.total)}</TableCell>
                      <TableCell>{fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-4 h-4" /></Button>}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Card className="w-64"><CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm"><span>Taxable</span><span>{formatCurrency(totals.taxable)}</span></div>
            <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCurrency(totals.cgst + totals.sgst + totals.igst)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
          </CardContent></Card>
        </div>

        <div className="flex gap-3">
          <Link href="/purchase-orders"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create PO'}</Button>
        </div>
      </form>
    </div>
  )
}
