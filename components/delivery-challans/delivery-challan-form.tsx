'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentPartyCard } from '@/components/shared/document-party-card'
import { DocumentTermsField } from '@/components/shared/document-terms-field'
import { useToast, toastSuccessNavigate } from '@/hooks/use-toast'
import { useDocumentPartyFields } from '@/hooks/use-document-party-fields'
import { useDefaultDocumentTerms } from '@/hooks/use-default-document-terms'
import { challanSchema, type ChallanInput } from '@/lib/validations'
import type { PartyCustomer, PartyFields } from '@/lib/party-fields'
import { parseQuotationPartyDetails } from '@/lib/quotation-party'
import { FormPageLoader } from '@/components/layout/page-loader'
import { formatCurrency, GST_RATES, roundToTwo, cn } from '@/lib/utils'
import { computeSalesDocumentLineTotals, normalizeProductDiscountPercent } from '@/lib/sales-document-totals'
import { Plus, Trash2, ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  description?: string | null
  selling_price: number
  gst_rate: number
  discount?: number | string | null
  hsn_code?: string | null
  sac_code?: string | null
  current_stock?: number
  low_stock_alert?: number | null
  unit_short_name?: string | null
}

type ItemMeta = { hsnSac: string; productName: string; listOpen: boolean }
type PendingItemMetaRow = { productName: string; hsnSac: string }

export interface DeliveryChallanFormProps {
  mode: 'create' | 'edit'
  challanId?: string
}

const defaultItem: ChallanInput['items'][number] = {
  productId: '',
  description: '',
  quantity: 1,
  rate: 0,
  discount: 0,
  gstRate: 0,
  unit: '',
}

function computeChallanLineTotals(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number
) {
  const line = computeSalesDocumentLineTotals(qty, rate, discountPercent, gstRate, 'CGST_SGST')
  return {
    taxableGross: line.taxableGross,
    discountAmount: line.discountAmount,
    gst: line.gst,
    finalAmount: line.finalAmount,
  }
}

const readOnlyInputClass = 'h-9 bg-muted/60 cursor-default'

function formatHsnSac(hsn: string | null | undefined, sac: string | null | undefined): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || ''
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.split('T')[0].split(' ')[0]
  return value.toISOString().split('T')[0]
}

export function DeliveryChallanForm({ mode, challanId }: DeliveryChallanFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = mode === 'edit'
  const today = new Date().toISOString().split('T')[0]
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const [challanNo, setChallanNo] = useState<string | null>(null)
  const [pendingItemMeta, setPendingItemMeta] = useState<PendingItemMetaRow[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<PartyCustomer[]>([])
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({})
  const productSearchRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const form = useForm<ChallanInput>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      customerId: '',
      date: today,
      terms: '',
      items: [defaultItem],
    },
  })

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')

  const party = useDocumentPartyFields(customers)
  const { loadParties } = party

  const applyDefaultTerms = useCallback(
    (terms: string) => setValue('terms', terms),
    [setValue]
  )
  useDefaultDocumentTerms('delivery-challan', !isEdit, applyDefaultTerms)

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
    if (!isEdit || !challanId) return
    let cancelled = false

    const load = async () => {
      setLoadingInitial(true)
      try {
        const [cRes, pRes, custRes] = await Promise.all([
          fetch(`/api/delivery-challans/${challanId}`),
          fetch('/api/products?limit=500'),
          fetch('/api/customers?limit=200'),
        ])
        if (!cRes.ok) throw new Error('Delivery challan not found')
        const data = await cRes.json()
        const pData = await pRes.json()
        const custData = await custRes.json()
        if (cancelled) return

        const productList: Product[] = pData.products || []
        const customerList: PartyCustomer[] = custData.customers || []
        setProducts(productList)
        setCustomers(customerList)
        setChallanNo(data.challan_no ?? null)

        const linkedCustomer = customerList.find((c) => c.id === data.customer_id)
        const partyDetails = parseQuotationPartyDetails(data.party_details)
        const buyerFromDb = partyDetails?.buyer
        const consigneeFromDb = partyDetails?.consignee

        const buyer: PartyFields = {
          name: buyerFromDb?.name || data.customer_name || linkedCustomer?.name || '',
          contactPerson: buyerFromDb?.contactPerson || linkedCustomer?.contact_person || '',
          address: buyerFromDb?.address || linkedCustomer?.billing_address || '',
          mobile: buyerFromDb?.mobile || linkedCustomer?.mobile || linkedCustomer?.phone || '',
          gstin: buyerFromDb?.gstin || linkedCustomer?.gstin || '',
          pan: buyerFromDb?.pan || linkedCustomer?.pan || '',
          city: buyerFromDb?.city || linkedCustomer?.billing_city || '',
        }

        const consignee: PartyFields = {
          name: consigneeFromDb?.name || buyer.name,
          contactPerson: consigneeFromDb?.contactPerson || buyer.contactPerson,
          address: consigneeFromDb?.address || linkedCustomer?.shipping_address || buyer.address,
          mobile: consigneeFromDb?.mobile || buyer.mobile,
          gstin: consigneeFromDb?.gstin || buyer.gstin,
          pan: consigneeFromDb?.pan || buyer.pan,
          city: consigneeFromDb?.city || linkedCustomer?.shipping_city || buyer.city,
        }

        loadParties(buyer, consignee)

        const rawItems = Array.isArray(data.items) ? data.items : []
        const formItems = rawItems.map((item: {
          product_id: string
          description?: string | null
          quantity: number
          rate?: number
          discount?: number
          gst_rate?: number
        }) => ({
          productId: item.product_id || '',
          description: item.description || '',
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          discount: Number(item.discount) || 0,
          gstRate: Number(item.gst_rate) || 0,
          unit: 'Nos',
        }))

        const metaRows: PendingItemMetaRow[] = formItems.map((item: ChallanInput['items'][number]) => {
          const p = productList.find((x) => x.id === item.productId)
          return {
            productName: p?.name ?? '',
            hsnSac: p ? formatHsnSac(p.hsn_code, p.sac_code) : '',
          }
        })

        reset({
          customerId: data.customer_id || '',
          date: toDateInput(data.date) || today,
          completionDate: data.completion_date ? toDateInput(data.completion_date) : undefined,
          terms: data.terms || '',
          items: formItems.length > 0 ? formItems : [defaultItem],
        })
        setPendingItemMeta(metaRows.length > 0 ? metaRows : null)
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Failed to load delivery challan'
        toast({ title: message, variant: 'destructive' })
        router.push('/delivery-challans')
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isEdit, challanId, reset, today, toast, router, loadParties])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      for (const field of fields) {
        const ref = productSearchRefs.current[field.id]
        if (ref && !ref.contains(e.target as Node)) {
          setItemMeta((prev) => {
            const cur = prev[field.id]
            if (!cur?.listOpen) return prev
            return { ...prev, [field.id]: { ...cur, listOpen: false } }
          })
        }
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [fields])

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

  const getUsedProductIds = useCallback(
    (excludeIndex: number) => {
      const ids = new Set<string>()
      items?.forEach((item, idx) => {
        if (idx !== excludeIndex && item?.productId) ids.add(item.productId)
      })
      return ids
    },
    [items]
  )

  const getFilteredProducts = useCallback(
    (index: number, query: string) => {
      const used = getUsedProductIds(index)
      const currentId = items?.[index]?.productId
      const q = query.trim().toLowerCase()
      return products.filter((p) => {
        if (used.has(p.id) && p.id !== currentId) return false
        if (!q) return true
        return p.name.toLowerCase().includes(q)
      })
    },
    [products, items, getUsedProductIds]
  )

  const updateItemMeta = (fieldId: string, patch: Partial<ItemMeta>) => {
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: { ...(prev[fieldId] || { hsnSac: '', productName: '', listOpen: false }), ...patch },
    }))
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
    setValue(`items.${index}.description`, p.description || p.name)
    setValue(`items.${index}.rate`, Number(p.selling_price) || 0)
    setValue(`items.${index}.gstRate`, Number(p.gst_rate) || 0)
    setValue(`items.${index}.discount`, normalizeProductDiscountPercent(p.discount))
    setValue(`items.${index}.unit`, p.unit_short_name || 'Nos')
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: {
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

  const addProductCard = () => {
    append({ productId: '', description: '', quantity: 1, rate: 0, discount: 0, gstRate: 0, unit: '' })
  }

  const handleBuyerNameChange = (value: string) => {
    party.updateBuyerField('name', value)
    party.setCustomerListOpen(true)
    const match = customers.find((c) => c.name === value)
    if (match) {
      party.applyCustomer(match, (id) => setValue('customerId', id, { shouldValidate: true }))
    } else {
      setValue('customerId', '')
    }
  }

  const validateBeforeSubmit = (data: ChallanInput): string | null => {
    const ids = data.items.map((i) => i.productId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return 'Duplicate products are not allowed'
    if (ids.length !== data.items.length) return 'Please select a product for every line item'
    return party.validateParties(data.customerId)
  }

  const onSubmit = async (data: ChallanInput) => {
    const customError = validateBeforeSubmit(data)
    if (customError) {
      toast({ title: 'Validation', description: customError, variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload: ChallanInput = {
        ...data,
        partyDetails: party.getPartyDetails(),
      }
      const url = isEdit ? `/api/delivery-challans/${challanId}` : '/api/delivery-challans'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(
          typeof e.error === 'string'
            ? e.error
            : isEdit
              ? 'Failed to update delivery challan'
              : 'Failed to create delivery challan'
        )
      }
      toastSuccessNavigate(
        isEdit ? 'Delivery challan updated' : 'Delivery challan created',
        () => router.push('/delivery-challans')
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return <FormPageLoader title="delivery challan form" />
  }

  return (
    <div className="space-y-6 max-w-5xl w-full min-w-0">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/delivery-challans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {isEdit ? `Edit Delivery Challan${challanNo ? ` — ${challanNo}` : ''}` : 'New Delivery Challan'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update delivery challan details' : 'Create a delivery challan for goods dispatch'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-base">Challan Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2 min-w-0">
                <Label className="text-xs sm:text-sm">Challan Date *</Label>
                <Input
                  type="date"
                  className="h-9 w-full min-w-0 text-sm px-2 sm:px-3"
                  {...register('date')}
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2 min-w-0">
                <Label className="text-xs sm:text-sm">Completion Date</Label>
                <Input
                  type="date"
                  className="h-9 w-full min-w-0 text-sm px-2 sm:px-3"
                  {...register('completionDate')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <DocumentPartyCard
          buyerFields={party.buyerFields}
          consigneeFields={party.consigneeFields}
          buyerContactErrors={party.buyerContactErrors}
          consigneeContactErrors={party.consigneeContactErrors}
          sameAsBuyer={party.sameAsBuyer}
          customerListOpen={party.customerListOpen}
          customerSearchRef={party.customerSearchRef}
          filteredCustomers={party.filteredCustomers}
          customerError={errors.customerId?.message}
          onBuyerFieldChange={party.updateBuyerField}
          onConsigneeFieldChange={party.updateConsigneeField}
          onSameAsBuyerChange={party.handleSameAsBuyerChange}
          onCustomerNameChange={handleBuyerNameChange}
          onCustomerFocus={() => party.setCustomerListOpen(true)}
          onSelectCustomer={(c) =>
            party.applyCustomer(c, (id) => setValue('customerId', id, { shouldValidate: true }))
          }
        />

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
              const item = items?.[i]
              const meta = itemMeta[field.id] || { hsnSac: '', productName: '', listOpen: false }
              const filteredProducts = getFilteredProducts(i, meta.productName)

              const line = computeChallanLineTotals(
                item?.quantity || 0,
                item?.rate || 0,
                item?.discount || 0,
                item?.gstRate || 0
              )

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
                            {filteredProducts.map((p) => {
                              const lowAlert = Number(p.low_stock_alert ?? 0)
                              const stock = Number(p.current_stock ?? 0)
                              const isLowOrOut = stock <= lowAlert
                              return (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => applyProduct(field.id, i, p.id)}
                                  >
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span
                                      className={cn(
                                        'shrink-0 text-xs font-semibold tabular-nums',
                                        isLowOrOut ? 'text-yellow-600' : 'text-green-600'
                                      )}
                                    >
                                      Stock: {stock}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
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
                          readOnly
                          tabIndex={-1}
                          value={meta.hsnSac}
                          placeholder="HSN or SAC"
                          className={cn(readOnlyInputClass, 'font-mono text-xs')}
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
                        <Label className="text-xs">Discount %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="h-9 no-spinner"
                          value={Number.isFinite(item?.discount) ? item.discount : ''}
                          onChange={(e) => {
                            const raw = e.target.value
                            const num = raw === '' ? 0 : Math.min(100, Math.max(0, roundToTwo(parseFloat(raw) || 0)))
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

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <DocumentTermsField register={register} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 pb-2 sm:pb-0">
          <Link href="/delivery-challans">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Challan'}
          </Button>
        </div>
      </form>
    </div>
  )
}
