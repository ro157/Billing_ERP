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
import { useToast, toastSuccessNavigate } from '@/hooks/use-toast'
import { useDefaultDocumentTerms } from '@/hooks/use-default-document-terms'
import { DocumentTermsField } from '@/components/shared/document-terms-field'
import { purchaseOrderSchema, type PurchaseOrderInput } from '@/lib/validations'
import { calculateGST, calculateItemAmount, formatCurrency, GST_RATES, cn } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'
import { ContactFieldInputs } from '@/components/shared/contact-field-inputs'

interface Product {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  hsn_code?: string | null
  sac_code?: string | null
  purchase_price: number
  gst_rate: number
}

interface Vendor {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  address?: string | null
  city?: string | null
}

type VendorFields = {
  name: string
  contactPerson: string
  mobile: string
  gstin: string
  address: string
  city: string
}

type ItemMeta = {
  productName: string
  listOpen: boolean
  hsnSac: string
}

const emptyVendorFields: VendorFields = {
  name: '',
  contactPerson: '',
  mobile: '',
  gstin: '',
  address: '',
  city: '',
}

function defaultItemMeta(): ItemMeta {
  return { productName: '', listOpen: false, hsnSac: '' }
}

function formatHsnSac(hsn: string | null | undefined, sac: string | null | undefined): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || ''
}

function toDateInput(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return String(value).slice(0, 10)
}

export function PurchaseOrderForm({ purchaseOrderId }: { purchaseOrderId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(purchaseOrderId)
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const [poNo, setPoNo] = useState('')
  const editLoadedRef = useRef(false)
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorFields, setVendorFields] = useState<VendorFields>(emptyVendorFields)
  const [vendorListOpen, setVendorListOpen] = useState(false)
  const vendorSearchRef = useRef<HTMLDivElement>(null)
  const productSearchRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({})

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      gstType: 'CGST_SGST',
      items: [{ productId: '', description: '', quantity: 1, rate: 0, discount: 0, gstRate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const gstType = watch('gstType')

  const applyDefaultTerms = useCallback(
    (terms: string) => setValue('terms', terms),
    [setValue]
  )
  useDefaultDocumentTerms('purchase-order', !isEdit, applyDefaultTerms)

  const filteredVendors = useMemo(() => {
    const q = vendorFields.name.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter((v) => v.name.toLowerCase().includes(q))
  }, [vendors, vendorFields.name])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (vendorSearchRef.current && !vendorSearchRef.current.contains(e.target as Node)) {
        setVendorListOpen(false)
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
        if (!next[f.id]) next[f.id] = defaultItemMeta()
      }
      const ids = new Set(fields.map((f) => f.id))
      for (const key of Object.keys(next)) {
        if (!ids.has(key)) delete next[key]
      }
      return next
    })
  }, [fields])

  useEffect(() => {
    fetch('/api/products?limit=500')
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
    fetch('/api/vendors?limit=200')
      .then((r) => r.json())
      .then((d) => setVendors(d.vendors || []))
  }, [])

  useEffect(() => {
    if (!purchaseOrderId || editLoadedRef.current) return
    const loadPurchaseOrder = async () => {
      setLoadingInitial(true)
      try {
        const res = await fetch(`/api/purchase-orders/${purchaseOrderId}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setPoNo(data.po_no || '')
        reset({
          vendorId: data.vendor_id,
          date: toDateInput(data.date) || new Date().toISOString().split('T')[0],
          expectedDate: toDateInput(data.expected_date),
          gstType: 'CGST_SGST',
          notes: data.notes || '',
          terms: data.terms || '',
          items:
            (data.items || []).length > 0
              ? data.items.map(
                  (item: {
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
                  })
                )
              : [{ productId: '', description: '', quantity: 1, rate: 0, discount: 0, gstRate: 0 }],
        })
        setVendorFields({
          name: data.vendor_name || '',
          contactPerson: data.vendor_contact_person || '',
          mobile: data.vendor_phone || data.vendor_mobile || '',
          gstin: data.vendor_gstin || '',
          address: data.vendor_address || '',
          city: data.vendor_city || '',
        })
        editLoadedRef.current = true
      } catch {
        toast({ title: 'Error', description: 'Could not load purchase order', variant: 'destructive' })
        router.push('/purchase-orders')
      } finally {
        setLoadingInitial(false)
      }
    }
    loadPurchaseOrder()
  }, [purchaseOrderId, reset, router, toast])

  useEffect(() => {
    if (!purchaseOrderId || !editLoadedRef.current || !products.length) return
    setItemMeta((prev) => {
      const next = { ...prev }
      let changed = false
      fields.forEach((field, i) => {
        const productId = watchedItems?.[i]?.productId
        if (!productId) return
        const product = products.find((p) => p.id === productId)
        if (product && !next[field.id]?.productName) {
          next[field.id] = {
            ...(next[field.id] || defaultItemMeta()),
            productName: product.name,
            hsnSac: formatHsnSac(product.hsn_code, product.sac_code),
          }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [purchaseOrderId, products, fields, watchedItems])

  const applyVendor = (v: Vendor) => {
    setValue('vendorId', v.id, { shouldValidate: true })
    setVendorFields({
      name: v.name,
      contactPerson: v.contact_person || '',
      mobile: v.phone || v.mobile || '',
      gstin: v.gstin || '',
      address: v.address || '',
      city: v.city || '',
    })
    setVendorListOpen(false)
  }

  const handleVendorNameChange = (value: string) => {
    setVendorFields((prev) => ({ ...prev, name: value }))
    setVendorListOpen(true)
    const match = vendors.find((v) => v.name === value)
    if (match) applyVendor(match)
    else setValue('vendorId', '')
  }

  const updateVendorField = <K extends keyof VendorFields>(key: K, value: VendorFields[K]) => {
    setVendorFields((prev) => ({ ...prev, [key]: value }))
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
      return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    })
  }

  const updateItemMeta = (fieldId: string, patch: Partial<ItemMeta>) => {
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || defaultItemMeta()), ...patch },
    }))
  }

  const applyProduct = (fieldId: string, index: number, productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    if (getUsedProductIds(index).has(productId)) {
      toast({ title: 'Product already added on another line', variant: 'destructive' })
      return
    }
    setValue(`items.${index}.productId`, productId, { shouldValidate: true })
    setValue(`items.${index}.description`, p.description || p.name)
    setValue(`items.${index}.rate`, p.purchase_price)
    setValue(`items.${index}.gstRate`, p.gst_rate)
    updateItemMeta(fieldId, {
      productName: p.name,
      hsnSac: formatHsnSac(p.hsn_code, p.sac_code),
      listOpen: false,
    })
  }

  const handleProductNameChange = (fieldId: string, index: number, value: string) => {
    updateItemMeta(fieldId, { productName: value, listOpen: true })
    const match = products.find((p) => p.name.toLowerCase() === value.trim().toLowerCase())
    if (match) applyProduct(fieldId, index, match.id)
    else setValue(`items.${index}.productId`, '')
  }

  const computeTotals = useCallback(() => {
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    for (const item of watchedItems || []) {
      const amount = calculateItemAmount(item.quantity || 0, item.rate || 0, 0)
      const tax = calculateGST(amount, item.gstRate || 0, gstType || 'CGST_SGST')
      taxable += amount
      cgst += tax.cgst || 0
      sgst += tax.sgst || 0
      igst += tax.igst || 0
    }
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst }
  }, [watchedItems, gstType])

  const totals = computeTotals()

  const onSubmit = async (data: PurchaseOrderInput) => {
    setSaving(true)
    try {
      const url = isEdit ? `/api/purchase-orders/${purchaseOrderId}` : '/api/purchase-orders'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json()
        const errMsg = Array.isArray(e.error)
          ? e.error.map((x: { message?: string }) => x.message).filter(Boolean).join(', ')
          : e.error || 'Failed'
        throw new Error(errMsg)
      }
      toastSuccessNavigate(
        isEdit ? 'Purchase order updated' : 'Purchase order created',
        () => router.push('/purchase-orders')
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Loading purchase order...
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-6xl min-w-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <Link href="/purchase-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">
            {isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          {isEdit && poNo && <p className="text-sm text-muted-foreground">{poNo}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" className="h-9" {...register('date')} />
                {errors.date && (
                  <p className="text-destructive text-xs">{String(errors.date.message)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input type="date" className="h-9" {...register('expectedDate')} />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label>GST Type</Label>
                <Select
                  value={gstType}
                  onValueChange={(v) => setValue('gstType', v as PurchaseOrderInput['gstType'])}
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
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label>Reference / Notes</Label>
                <Input className="h-9" {...register('notes')} placeholder="Optional notes..." />
              </div>
            </div>

            <div className="border-t pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2 relative" ref={vendorSearchRef}>
                <Label>Vendor Name *</Label>
                <Input
                  value={vendorFields.name}
                  onChange={(e) => handleVendorNameChange(e.target.value)}
                  onFocus={() => setVendorListOpen(true)}
                  placeholder="Type to search vendor..."
                  autoComplete="off"
                  className="h-9"
                />
                {vendorListOpen && filteredVendors.length > 0 && (
                  <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
                    {filteredVendors.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyVendor(v)}
                        >
                          <span className="font-medium">{v.name}</span>
                          {v.gstin && (
                            <span className="ml-2 text-xs text-muted-foreground font-mono">{v.gstin}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {errors.vendorId && (
                  <p className="text-destructive text-xs">Please select a vendor from the list</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  className="h-9"
                  value={vendorFields.contactPerson}
                  onChange={(e) => updateVendorField('contactPerson', e.target.value)}
                />
              </div>

              <ContactFieldInputs
                mobile={vendorFields.mobile}
                gstin={vendorFields.gstin}
                onMobileChange={(value) => updateVendorField('mobile', value)}
                onGstinChange={(value) => updateVendorField('gstin', value)}
              />

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  className="h-9"
                  value={vendorFields.city}
                  onChange={(e) => updateVendorField('city', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  className="min-h-[2.25rem] resize-none sm:min-h-[4rem]"
                  value={vendorFields.address}
                  onChange={(e) => updateVendorField('address', e.target.value)}
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
              const meta = itemMeta[field.id] || defaultItemMeta()
              const filteredProducts = getFilteredProducts(i, meta.productName)
              const amount = calculateItemAmount(item?.quantity || 0, item?.rate || 0, 0)
              const gst = calculateGST(amount, item?.gstRate || 0, gstType || 'CGST_SGST')
              const lineTotal = amount + gst.total

              return (
                <div key={field.id} className={cn(i > 0 && 'border-t border-muted-foreground/20')}>
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
                        ref={(el) => {
                          productSearchRefs.current[field.id] = el
                        }}
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-dashed">
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
                        <Label className="text-xs">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                            ₹
                          </span>
                          <Input
                            readOnly
                            className="h-9 pl-7 font-semibold bg-muted/30"
                            value={Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : ''}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="border-t border-muted-foreground/20 px-4 py-3 flex justify-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  append({
                    productId: '',
                    description: '',
                    quantity: 1,
                    rate: 0,
                    discount: 0,
                    gstRate: 0,
                  })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
          <Card className="h-full">
            <CardContent className="p-4">
              <DocumentTermsField register={register} />
            </CardContent>
          </Card>

          <Card className="shadow-md border-primary/10 w-full lg:max-w-none">
            <CardHeader className="pb-2 bg-muted/40">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span>{formatCurrency(totals.taxable)}</span>
            </div>
            {gstType === 'CGST_SGST' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST</span>
                  <span>{formatCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST</span>
                  <span>{formatCurrency(totals.sgst)}</span>
                </div>
              </>
            )}
            {gstType === 'IGST' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IGST</span>
                <span>{formatCurrency(totals.igst)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-3">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <Link href="/purchase-orders" className="min-w-0">
            <Button type="button" variant="outline" className="h-9 w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="h-9 w-full sm:w-auto">
            {saving ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
          </Button>
        </div>
      </form>
    </div>
  )
}
