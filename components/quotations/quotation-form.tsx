'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { quotationSchema, type QuotationInput } from '@/lib/validations'
import { computeLineTotals } from '@/lib/quotation-totals'
import { computeRoundOff, formatCurrency, GST_RATES, roundToNearestRupee, roundToTwo, cn } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft, Package, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  selling_price: number
  gst_rate: number
  hsn_code?: string | null
  sac_code?: string | null
}

interface Customer {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  gstin?: string | null
  pan?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_pincode?: string | null
}

type CustomerFields = {
  name: string
  contactPerson: string
  address: string
  mobile: string
  gstin: string
  city: string
}

type ItemMeta = { hsnSac: string; productName: string; listOpen: boolean }

type PendingItemMetaRow = { productName: string; hsnSac: string }

export type QuotationFormProps = {
  mode: 'create' | 'edit'
  quotationId?: string
}

const emptyCustomerFields: CustomerFields = {
  name: '',
  contactPerson: '',
  address: '',
  mobile: '',
  gstin: '',
  city: '',
}

const defaultItem = {
  productId: '',
  description: '',
  quantity: 1,
  rate: 0,
  discount: 0,
  gstRate: 18,
}

const readOnlyInputClass = 'h-9 bg-muted/60 cursor-default'

function formatHsnSac(hsn: string | null | undefined, sac: string | null | undefined): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || ''
}

function formatApiError(error: unknown): string {
  if (typeof error === 'string') return error
  if (Array.isArray(error)) {
    return error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || 'Validation failed'
  }
  return 'Something went wrong'
}

function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.split('T')[0].split(' ')[0]
  return value.toISOString().split('T')[0]
}

export function QuotationForm({ mode, quotationId }: QuotationFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const today = new Date().toISOString().split('T')[0]
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(isEdit)
  const [quotationNo, setQuotationNo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerFields, setCustomerFields] = useState<CustomerFields>(emptyCustomerFields)
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement>(null)
  const productSearchRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({})
  const [pendingItemMeta, setPendingItemMeta] = useState<PendingItemMetaRow[] | null>(null)

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<QuotationInput>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      date: today,
      gstType: 'CGST_SGST',
      roundOff: 0,
      items: [defaultItem],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const gstType = watch('gstType')

  const filteredCustomers = useMemo(() => {
    const q = customerFields.name.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, customerFields.name])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerListOpen(false)
      }
      setItemMeta((prev) => {
        let changed = false
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          const el = productSearchRefs.current[key]
          if (next[key]?.listOpen && el && !el.contains(e.target as Node)) {
            next[key] = { ...next[key], listOpen: false }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    setItemMeta((prev) => {
      const next = { ...prev }
      for (const f of fields) {
        if (!next[f.id]) next[f.id] = { hsnSac: '', productName: '', listOpen: false }
      }
      const ids = new Set(fields.map((f) => f.id))
      for (const key of Object.keys(next)) {
        if (!ids.has(key)) delete next[key]
      }
      return next
    })
  }, [fields])

  useEffect(() => {
    if (!pendingItemMeta?.length || fields.length !== pendingItemMeta.length) return
    setItemMeta((prev) => {
      const next = { ...prev }
      fields.forEach((field, i) => {
        next[field.id] = {
          ...(next[field.id] || { listOpen: false }),
          productName: pendingItemMeta[i].productName,
          hsnSac: pendingItemMeta[i].hsnSac,
          listOpen: false,
        }
      })
      return next
    })
    setPendingItemMeta(null)
  }, [fields, pendingItemMeta])

  useEffect(() => {
    if (isEdit) return
    fetch('/api/products?limit=500').then((r) => r.json()).then((d) => setProducts(d.products || []))
    fetch('/api/customers?limit=200').then((r) => r.json()).then((d) => setCustomers(d.customers || []))
  }, [isEdit])

  useEffect(() => {
    if (!isEdit || !quotationId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [qRes, pRes, cRes] = await Promise.all([
          fetch(`/api/quotations/${quotationId}`),
          fetch('/api/products?limit=500'),
          fetch('/api/customers?limit=200'),
        ])
        if (!qRes.ok) throw new Error('Quotation not found')
        const q = await qRes.json()
        const pData = await pRes.json()
        const cData = await cRes.json()
        if (cancelled) return

        const productList: Product[] = pData.products || []
        const customerList: Customer[] = cData.customers || []
        setProducts(productList)
        setCustomers(customerList)
        setQuotationNo(q.quotation_no ?? null)

        setCustomerFields({
          name: q.customer_name || '',
          contactPerson: q.customer_contact_person || '',
          address: q.customer_address || '',
          mobile: q.customer_phone || q.customer_mobile || '',
          gstin: q.customer_gstin || '',
          city: q.customer_city || '',
        })

        const rawItems = Array.isArray(q.items) ? q.items : []
        const formItems = rawItems.map((item: {
          product_id: string
          description?: string | null
          quantity: number
          rate: number
          discount?: number
          gst_rate: number
        }) => ({
          productId: item.product_id,
          description: item.description || '',
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          discount: Number(item.discount) || 0,
          gstRate: Number(item.gst_rate),
        }))

        const metaRows: PendingItemMetaRow[] = formItems.map((item) => {
          const p = productList.find((x) => x.id === item.productId)
          return {
            productName: p?.name ?? '',
            hsnSac: p ? formatHsnSac(p.hsn_code, p.sac_code) : '',
          }
        })

        reset({
          customerId: q.customer_id,
          date: toDateInputValue(q.date) || today,
          validUntil: q.valid_until ? toDateInputValue(q.valid_until) : undefined,
          gstType: 'CGST_SGST',
          roundOff: Number(q.round_off) || 0,
          notes: q.notes || undefined,
          terms: q.terms || undefined,
          items: formItems.length > 0 ? formItems : [defaultItem],
        })
        setPendingItemMeta(metaRows.length > 0 ? metaRows : null)
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Failed to load quotation'
        toast({ title: message, variant: 'destructive' })
        router.push('/quotations')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isEdit, quotationId, reset, today, toast, router])

  const applyCustomer = (c: Customer) => {
    setValue('customerId', c.id, { shouldValidate: true })
    setCustomerFields({
      name: c.name,
      contactPerson: c.contact_person || '',
      address: c.billing_address || '',
      mobile: c.phone || c.mobile || '',
      gstin: c.gstin || '',
      city: c.billing_city || '',
    })
    setCustomerListOpen(false)
  }

  const handleCustomerNameChange = (value: string) => {
    setCustomerFields((prev) => ({ ...prev, name: value }))
    setCustomerListOpen(true)
    const match = customers.find((c) => c.name === value)
    if (match) applyCustomer(match)
    else setValue('customerId', '')
  }

  const updateCustomerField = <K extends keyof CustomerFields>(key: K, value: CustomerFields[K]) => {
    setCustomerFields((prev) => ({ ...prev, [key]: value }))
  }

  const getUsedProductIds = (excludeIndex: number) => {
    const ids = new Set<string>()
    watchedItems?.forEach((item, idx) => {
      if (idx !== excludeIndex && item?.productId) ids.add(item.productId)
    })
    return ids
  }

  const getFilteredProducts = (index: number, query: string) => {
    const used = getUsedProductIds(index)
    const currentId = watchedItems?.[index]?.productId
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (used.has(p.id) && p.id !== currentId) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      )
    })
  }

  const applyProduct = (fieldId: string, index: number, productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const used = getUsedProductIds(index)
    if (used.has(productId)) {
      toast({ title: 'Product already added on another line', variant: 'destructive' })
      return
    }
    setValue(`items.${index}.productId`, productId, { shouldValidate: true })
    setValue(`items.${index}.rate`, Number(p.selling_price))
    setValue(`items.${index}.gstRate`, Number(p.gst_rate))
    setValue(`items.${index}.description`, p.description || p.name)
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] || { hsnSac: '', productName: '', listOpen: false }),
        productName: p.name,
        hsnSac: formatHsnSac(p.hsn_code, p.sac_code),
        listOpen: false,
      },
    }))
  }

  const handleProductNameChange = (fieldId: string, index: number, value: string) => {
    updateItemMeta(fieldId, { productName: value, listOpen: true })
    const match = products.find((p) => p.name.toLowerCase() === value.trim().toLowerCase())
    if (match) applyProduct(fieldId, index, match.id)
    else setValue(`items.${index}.productId`, '')
  }

  const updateItemMeta = (fieldId: string, patch: Partial<ItemMeta>) => {
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || { hsnSac: '', productName: '', listOpen: false }), ...patch },
    }))
  }

  const addProductCard = () => {
    append({ ...defaultItem })
  }

  const computeSummary = useCallback(() => {
    let taxableTotal = 0
    let totalDiscount = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    let grandTotal = 0

    for (const item of watchedItems || []) {
      const line = computeLineTotals(
        item?.quantity || 0,
        item?.rate || 0,
        item?.discount || 0,
        item?.gstRate || 0,
        gstType
      )
      taxableTotal += line.amountBeforeGst
      totalDiscount += roundToTwo(
        Math.min(Math.max(0, Number(item?.discount) || 0), line.totalWithGst)
      )
      cgst += line.gst.cgst
      sgst += line.gst.sgst
      igst += line.gst.igst
      grandTotal += line.finalAmount
    }

    return {
      taxableTotal: roundToTwo(taxableTotal),
      totalDiscount: roundToTwo(totalDiscount),
      cgst: roundToTwo(cgst),
      sgst: roundToTwo(sgst),
      igst: roundToTwo(igst),
      grandTotalBeforeRound: roundToTwo(grandTotal),
    }
  }, [watchedItems, gstType])

  const summary = computeSummary()
  const roundOffAmount = useMemo(
    () => computeRoundOff(summary.grandTotalBeforeRound),
    [summary.grandTotalBeforeRound]
  )
  const finalGrandTotal = useMemo(
    () => roundToNearestRupee(summary.grandTotalBeforeRound),
    [summary.grandTotalBeforeRound]
  )

  useEffect(() => {
    setValue('roundOff', roundOffAmount)
  }, [roundOffAmount, setValue])

  const validateBeforeSubmit = (data: QuotationInput): string | null => {
    const ids = data.items.map((i) => i.productId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return 'Duplicate products are not allowed'
    if (ids.length !== data.items.length) return 'Please enter and select a product for every line item'
    return null
  }

  const onSubmit = async (data: QuotationInput) => {
    const customError = validateBeforeSubmit(data)
    if (customError) {
      toast({ title: 'Validation', description: customError, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = isEdit ? `/api/quotations/${quotationId}` : '/api/quotations'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(formatApiError(e.error) || 'Failed')
      }
      toast({ title: isEdit ? 'Quotation updated' : 'Quotation created successfully' })
      router.push('/quotations')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading quotation...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <div className="flex items-center gap-4">
        <Link href="/quotations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {isEdit ? 'Edit Quotation' : 'New Quotation'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit && quotationNo
              ? quotationNo
              : 'Create a professional GST quotation'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" className="h-9" {...register('date')} />
                {errors.date && <p className="text-destructive text-xs">{String(errors.date.message)}</p>}
              </div>
              <div className="space-y-2">
                <Label>Valid Till</Label>
                <Input type="date" className="h-9" min={today} {...register('validUntil')} />
              </div>
              <div className="space-y-2">
                <Label>GST Type</Label>
                <Select
                  value={gstType}
                  onValueChange={(v) => setValue('gstType', v as QuotationInput['gstType'])}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CGST_SGST">CGST + SGST</SelectItem>
                    <SelectItem value="IGST">IGST</SelectItem>
                    <SelectItem value="EXEMPT">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2 relative" ref={customerSearchRef}>
                <Label>Customer Name *</Label>
                <Input
                  value={customerFields.name}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => setCustomerListOpen(true)}
                  placeholder="Type to search customer..."
                  autoComplete="off"
                  className="h-9"
                />
                {customerListOpen && filteredCustomers.length > 0 && (
                  <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
                    {filteredCustomers.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyCustomer(c)}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.gstin && (
                            <span className="ml-2 text-xs text-muted-foreground font-mono">{c.gstin}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {errors.customerId && (
                  <p className="text-destructive text-xs">Please select a customer from the list</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  className="h-9"
                  value={customerFields.contactPerson}
                  onChange={(e) => updateCustomerField('contactPerson', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input
                  className="h-9"
                  value={customerFields.mobile}
                  onChange={(e) => updateCustomerField('mobile', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input
                  className="h-9 uppercase font-mono text-sm"
                  value={customerFields.gstin}
                  onChange={(e) => updateCustomerField('gstin', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  className="h-9"
                  value={customerFields.city}
                  onChange={(e) => updateCustomerField('city', e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  className="min-h-[4rem] resize-none"
                  value={customerFields.address}
                  onChange={(e) => updateCustomerField('address', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted-foreground/20 overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Items
            </CardTitle>
            <span className="text-xs text-muted-foreground">{fields.length} product(s)</span>
          </CardHeader>
          <CardContent className="p-0">
            {fields.map((field, i) => {
              const item = watchedItems?.[i]
              const meta = itemMeta[field.id] || { hsnSac: '', productName: '', listOpen: false }
              const filteredProducts = getFilteredProducts(i, meta.productName)
              const line = computeLineTotals(
                item?.quantity || 0,
                item?.rate || 0,
                item?.discount || 0,
                item?.gstRate || 0,
                gstType
              )

              return (
                <div
                  key={field.id}
                  className={cn(i > 0 && 'border-t border-muted-foreground/20')}
                >
                  <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-0">
                    <span className="text-sm font-semibold">Item {i + 1}</span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="p-4 pt-3 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div
                        className="space-y-2 relative"
                        ref={(el) => { productSearchRefs.current[field.id] = el }}
                      >
                        <Label>Product *</Label>
                        <Input
                          value={meta.productName}
                          onChange={(e) => handleProductNameChange(field.id, i, e.target.value)}
                          onFocus={() => updateItemMeta(field.id, { listOpen: true })}
                          placeholder="Type product name..."
                          autoComplete="off"
                          className="h-9"
                        />
                        {meta.listOpen && filteredProducts.length > 0 && (
                          <ul className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
                            {filteredProducts.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left hover:bg-accent font-medium"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => applyProduct(field.id, i, p.id)}
                                >
                                  {p.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {meta.listOpen && meta.productName.trim() && filteredProducts.length === 0 && (
                          <p className="text-xs text-muted-foreground">No matching product</p>
                        )}
                        {errors.items?.[i]?.productId && (
                          <p className="text-destructive text-xs">Please select a product from the list</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          rows={2}
                          className="min-h-[4.5rem] resize-none text-sm"
                          placeholder="Product description"
                          {...register(`items.${i}.description`)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>HSN/SAC</Label>
                        <Input
                          value={meta.hsnSac}
                          onChange={(e) => updateItemMeta(field.id, { hsnSac: e.target.value })}
                          placeholder="HSN or SAC"
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 border-t border-dashed">
                      <div className="space-y-2">
                        <Label className="text-xs">Qty *</Label>
                        <Input
                          type="number"
                          min="0.001"
                          step="any"
                          className="h-9 no-spinner"
                          {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Rate *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-9 no-spinner"
                          {...register(`items.${i}.rate`, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Taxable Amt.</Label>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={formatCurrency(line.taxableGross)}
                          className={readOnlyInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">GST %</Label>
                        <Select
                          value={String(item?.gstRate ?? 0)}
                          onValueChange={(v) => setValue(`items.${i}.gstRate`, parseFloat(v))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {r}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Discount</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-9 no-spinner"
                          value={Number.isFinite(item?.discount) ? item.discount : ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            const num = raw === '' ? 0 : roundToTwo(parseFloat(raw) || 0)
                            setValue(`items.${i}.discount`, num, { shouldDirty: true })
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={formatCurrency(line.finalAmount)}
                          className={cn(readOnlyInputClass, 'font-semibold')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="border-t border-muted-foreground/20 px-4 py-3 flex justify-center sm:justify-end">
              <Button type="button" variant="outline" onClick={addProductCard} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-primary/10 w-full max-w-xl ml-0 sm:ml-auto">
            <CardHeader className="pb-2 bg-muted/40">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span className="font-medium">{formatCurrency(summary.taxableTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Discount</span>
                <span className="font-medium text-orange-600">-{formatCurrency(summary.totalDiscount)}</span>
              </div>
              {gstType === 'CGST_SGST' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatCurrency(summary.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatCurrency(summary.sgst)}</span>
                  </div>
                </>
              )}
              {gstType === 'IGST' && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatCurrency(summary.igst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Round Off</span>
                <span className="font-medium">
                  {roundOffAmount >= 0 ? '+' : ''}
                  {formatCurrency(roundOffAmount)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-3">
                <span>Grand Total</span>
                <span className="text-primary">{formatCurrency(finalGrandTotal)}</span>
              </div>
            </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t">
          <Link href="/quotations">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving
              ? isEdit
                ? 'Updating...'
                : 'Creating...'
              : isEdit
                ? 'Update Quotation'
                : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  )
}
