'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceSchema, InvoiceInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { formatCurrency, calculateGST, calculateItemAmount, roundToTwo, GST_RATES } from '@/lib/utils'

interface SelectOption { id: string; name: string }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; hsn_code?: string }

export default function NewInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [customers, setCustomers] = useState<SelectOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      gstType: 'CGST_SGST',
      paymentMode: 'CASH',
      paidAmount: 0,
      items: [{ productId: '', quantity: 1, rate: 0, discount: 0, gstRate: 18 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  const gstType = form.watch('gstType')
  const items = form.watch('items')

  useEffect(() => {
    Promise.all([
      fetch('/api/customers?limit=200').then(r => r.json()),
      fetch('/api/products?limit=500').then(r => r.json()),
    ]).then(([custs, prods]) => {
      setCustomers(custs.customers)
      setProducts(prods.products)
    })
  }, [])

  const computedTotals = (() => {
    let subtotal = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0

    items.forEach((item) => {
      const amount = calculateItemAmount(item.quantity || 0, item.rate || 0, item.discount || 0)
      const gst = calculateGST(amount, item.gstRate || 0, gstType)
      subtotal += amount
      totalCgst += gst.cgst
      totalSgst += gst.sgst
      totalIgst += gst.igst
    })

    const taxAmount = roundToTwo(totalCgst + totalSgst + totalIgst)
    const totalAmount = roundToTwo(subtotal + taxAmount)

    return { subtotal: roundToTwo(subtotal), totalCgst: roundToTwo(totalCgst), totalSgst: roundToTwo(totalSgst), totalIgst: roundToTwo(totalIgst), taxAmount, totalAmount }
  })()

  const onProductChange = (idx: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      form.setValue(`items.${idx}.productId`, productId)
      form.setValue(`items.${idx}.rate`, product.selling_price)
      form.setValue(`items.${idx}.gstRate`, product.gst_rate)
    }
  }

  const onSubmit = async (data: InvoiceInput) => {
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create invoice')
      }
      toast({ title: 'Invoice created successfully' })
      router.push('/billing')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Invoice</h1>
          <p className="text-muted-foreground">Create a GST sales invoice</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Customer *</Label>
              <Select onValueChange={(v) => form.setValue('customerId', v)}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.customerId && (
                <p className="text-destructive text-xs">{form.formState.errors.customerId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" {...form.register('date')} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" {...form.register('dueDate')} />
            </div>
            <div className="space-y-2">
              <Label>GST Type *</Label>
              <Select defaultValue="CGST_SGST" onValueChange={(v) => form.setValue('gstType', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CGST_SGST">CGST + SGST (Intra-state)</SelectItem>
                  <SelectItem value="IGST">IGST (Inter-state)</SelectItem>
                  <SelectItem value="EXEMPT">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select defaultValue="CASH" onValueChange={(v) => form.setValue('paymentMode', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paid Amount (₹)</Label>
              <Input type="number" step="0.01" {...form.register('paidAmount', { valueAsNumber: true })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes..." {...form.register('notes')} />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: '', quantity: 1, rate: 0, discount: 0, gstRate: 18 })}
            >
              <Plus className="w-3 h-3 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 w-48">Product</th>
                  <th className="text-right pb-2 w-20">Qty</th>
                  <th className="text-right pb-2 w-28">Rate (₹)</th>
                  <th className="text-right pb-2 w-20">Disc %</th>
                  <th className="text-right pb-2 w-20">GST %</th>
                  <th className="text-right pb-2 w-28">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => {
                  const item = items[idx]
                  const amount = calculateItemAmount(item?.quantity || 0, item?.rate || 0, item?.discount || 0)
                  const gst = calculateGST(amount, item?.gstRate || 0, gstType)
                  const lineTotal = roundToTwo(amount + gst.total)

                  return (
                    <tr key={field.id} className="border-b">
                      <td className="py-2 pr-2">
                        <Select onValueChange={(v) => onProductChange(idx, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" step="0.01" className="h-8 text-right text-xs" {...form.register(`items.${idx}.quantity`, { valueAsNumber: true })} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" step="0.01" className="h-8 text-right text-xs" {...form.register(`items.${idx}.rate`, { valueAsNumber: true })} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input type="number" step="0.01" className="h-8 text-right text-xs" {...form.register(`items.${idx}.discount`, { valueAsNumber: true })} />
                      </td>
                      <td className="py-2 pr-2">
                        <Select defaultValue="18" onValueChange={(v) => form.setValue(`items.${idx}.gstRate`, Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                      <td className="py-2">
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(idx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(computedTotals.subtotal)}</span>
                </div>
                {gstType === 'CGST_SGST' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CGST</span>
                      <span>{formatCurrency(computedTotals.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SGST</span>
                      <span>{formatCurrency(computedTotals.totalSgst)}</span>
                    </div>
                  </>
                )}
                {gstType === 'IGST' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatCurrency(computedTotals.totalIgst)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(computedTotals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  )
}
