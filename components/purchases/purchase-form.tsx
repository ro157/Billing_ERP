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
import { purchaseSchema, type PurchaseInput } from '@/lib/validations'
import { calculateGST, formatCurrency, GST_RATES, roundToTwo, cn } from '@/lib/utils'
import { computePurchaseLineTotals } from '@/lib/purchase-totals'
import { Plus, Trash2, ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'
import { ContactFieldInputs } from '@/components/shared/contact-field-inputs'
import {
  firstPartyValidationError,
  type PartyFieldErrors,
  validatePartyContactFields,
} from '@/lib/field-validation'

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
  editableTaxable: number
  editableAmount: number
  taxableTouched: boolean
  amountTouched: boolean
  discountDraft?: string
  roundOffDraft?: string
}

function formatDiscountInputValue(value: number | undefined): string {
  if (value == null || value === 0) return ''
  if (Number.isInteger(value)) return String(value)
  const rounded = roundToTwo(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function parseDiscountInput(raw: string): number {
  if (raw === '' || raw === '-') return 0
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function sanitizeSignedDecimalInput(value: string): string {
  let s = value.replace(/[^\d.\-+]/g, '')
  const sign = s.startsWith('-') ? '-' : s.startsWith('+') ? '+' : ''
  s = s.replace(/^[+-]/, '').replace(/[+-]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  }
  return sign + s
}

function formatRoundOffInputValue(value: number | undefined): string {
  if (value == null || value === 0) return ''
  const rounded = roundToTwo(value)
  if (rounded > 0) return `+${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function parseRoundOffInput(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return 0
  const n = parseFloat(trimmed)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function toLineRoundOff(value: unknown): number {
  if (value === '' || value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function formatHsnSac(hsn: string | null | undefined, sac: string | null | undefined): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || ''
}

function defaultItemMeta(): ItemMeta {
  return {
    productName: '',
    listOpen: false,
    hsnSac: '',
    editableTaxable: 0,
    editableAmount: 0,
    taxableTouched: false,
    amountTouched: false,
  }
}

const emptyVendorFields: VendorFields = {
  name: '',
  contactPerson: '',
  mobile: '',
  gstin: '',
  address: '',
  city: '',
}

function computePurchaseLine(
  qty: number,
  rate: number,
  discountFlat: number,
  gstRate: number,
  gstType: PurchaseInput['gstType']
) {
  return computePurchaseLineTotals(qty, rate, discountFlat, gstRate, gstType)
}

function toDateInput(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return String(value).slice(0, 10)
}

export function PurchaseForm({ purchaseId }: { purchaseId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(purchaseId)
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const [purchaseNo, setPurchaseNo] = useState('')
  const editLoadedRef = useRef(false)
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorFields, setVendorFields] = useState<VendorFields>(emptyVendorFields)
  const [vendorContactErrors, setVendorContactErrors] = useState<PartyFieldErrors>({})
  const [vendorListOpen, setVendorListOpen] = useState(false)
  const vendorSearchRef = useRef<HTMLDivElement>(null)
  const productSearchRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({})

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      gstType: 'CGST_SGST',
      paidAmount: 0,
      paymentMode: 'CASH',
      roundOff: 0,
      items: [{ productId: '', description: '', quantity: 1, rate: 0, discount: 0, roundOff: 0, gstRate: 18 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const gstType = watch('gstType')
  const paymentMode = watch('paymentMode')
  const prevCalcItemsRef = useRef<PurchaseInput['items']>()

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
    fields.forEach((field, i) => {
      const item = watchedItems?.[i]
      if (!item) return
      const prev = prevCalcItemsRef.current?.[i]
      const calcInputsChanged =
        !prev ||
        prev.quantity !== item.quantity ||
        prev.rate !== item.rate ||
        prev.discount !== item.discount ||
        prev.gstRate !== item.gstRate
      const roundOffChanged = !prev || prev.roundOff !== item.roundOff
      const line = computePurchaseLine(
        item.quantity || 0,
        item.rate || 0,
        item.discount || 0,
        item.gstRate || 0,
        gstType
      )
      setItemMeta((prevMeta) => {
        const cur = prevMeta[field.id] || defaultItemMeta()
        const taxableTouched = calcInputsChanged ? false : cur.taxableTouched
        const amountTouched =
          calcInputsChanged || roundOffChanged ? false : cur.amountTouched
        const lineRoundOff = toLineRoundOff(item.roundOff)
        const taxable = taxableTouched ? cur.editableTaxable : line.amountBeforeGst
        const amount =
          amountTouched && !roundOffChanged
            ? cur.editableAmount
            : roundToTwo(line.finalAmount + lineRoundOff)
        if (
          cur.editableTaxable === taxable &&
          cur.editableAmount === amount &&
          cur.taxableTouched === taxableTouched &&
          cur.amountTouched === amountTouched
        ) {
          return prevMeta
        }
        return {
          ...prevMeta,
          [field.id]: {
            ...cur,
            taxableTouched,
            amountTouched,
            editableTaxable: taxable,
            editableAmount: amount,
          },
        }
      })
    })
    prevCalcItemsRef.current = watchedItems
  }, [watchedItems, gstType, fields])

  useEffect(() => {
    fetch('/api/products?limit=500').then((r) => r.json()).then((d) => setProducts(d.products || []))
    fetch('/api/vendors?limit=200').then((r) => r.json()).then((d) => setVendors(d.vendors || []))
  }, [])

  useEffect(() => {
    if (!purchaseId || editLoadedRef.current) return
    const loadPurchase = async () => {
      setLoadingInitial(true)
      try {
        const res = await fetch(`/api/purchases/${purchaseId}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setPurchaseNo(data.purchase_no || '')
        reset({
          vendorId: data.vendor_id,
          date: toDateInput(data.date) || new Date().toISOString().split('T')[0],
          dueDate: toDateInput(data.due_date),
          gstType: data.gst_type || 'CGST_SGST',
          billNo: data.bill_no || '',
          billDate: toDateInput(data.bill_date),
          paymentMode: data.payment_mode || 'CASH',
          paidAmount: Number(data.paid_amount) || 0,
          notes: data.notes || '',
          roundOff: Number(data.round_off) || 0,
          items: (data.items || []).length > 0
            ? data.items.map((item: {
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
                roundOff: 0,
                gstRate: Number(item.gst_rate),
              }))
            : [{ productId: '', description: '', quantity: 1, rate: 0, discount: 0, roundOff: 0, gstRate: 18 }],
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
        toast({ title: 'Error', description: 'Could not load purchase', variant: 'destructive' })
        router.push('/purchases')
      } finally {
        setLoadingInitial(false)
      }
    }
    loadPurchase()
  }, [purchaseId, reset, router, toast])

  useEffect(() => {
    if (!purchaseId || !editLoadedRef.current || !products.length) return
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
  }, [purchaseId, products, fields, watchedItems])

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
    if (key === 'mobile' || key === 'gstin') {
      setVendorContactErrors((prev) => ({ ...prev, [key]: undefined }))
    }
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

  const applyProduct = (fieldId: string, index: number, productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    if (getUsedProductIds(index).has(productId)) {
      toast({ title: 'Product already added on another line', variant: 'destructive' })
      return
    }
    setValue(`items.${index}.productId`, productId, { shouldValidate: true })
    setValue(`items.${index}.description`, p.description || p.name)
    setItemMeta((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] || defaultItemMeta()),
        productName: p.name,
        hsnSac: formatHsnSac(p.hsn_code, p.sac_code),
        listOpen: false,
        taxableTouched: false,
        amountTouched: false,
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
      [fieldId]: { ...(prev[fieldId] || defaultItemMeta()), ...patch },
    }))
  }

  const handleTaxableEdit = (fieldId: string, i: number, raw: string) => {
    const taxable = raw === '' ? 0 : roundToTwo(parseFloat(raw) || 0)
    const gstRate = watchedItems?.[i]?.gstRate || 0
    const discount = watchedItems?.[i]?.discount || 0
    const gst = calculateGST(taxable, gstRate, gstType)
    const totalWithGst = roundToTwo(taxable + gst.total)
    const disc = roundToTwo(Math.min(Math.max(0, discount), totalWithGst))
    const amount = roundToTwo(totalWithGst - disc)
    setItemMeta((prev) => {
      const cur = prev[fieldId] || defaultItemMeta()
      return {
        ...prev,
        [fieldId]: {
          ...cur,
          taxableTouched: true,
          editableTaxable: taxable,
          ...(cur.amountTouched ? {} : { editableAmount: amount, amountTouched: false }),
        },
      }
    })
  }

  const handleAmountEdit = (fieldId: string, raw: string) => {
    const amount = raw === '' ? 0 : roundToTwo(parseFloat(raw) || 0)
    setItemMeta((prev) => {
      const cur = prev[fieldId] || defaultItemMeta()
      return {
        ...prev,
        [fieldId]: { ...cur, amountTouched: true, editableAmount: amount },
      }
    })
  }

  const getEffectiveLine = (fieldId: string, i: number) => {
    const item = watchedItems?.[i]
    const meta = itemMeta[fieldId] || defaultItemMeta()
    const computed = computePurchaseLine(
      item?.quantity || 0,
      item?.rate || 0,
      item?.discount || 0,
      item?.gstRate || 0,
      gstType
    )

    const lineRoundOff = toLineRoundOff(item?.roundOff)
    const lineRoundOffP = Math.round(lineRoundOff * 100)

    if (!meta.taxableTouched && !meta.amountTouched) {
      return {
        taxable: computed.amountBeforeGst,
        amount: roundToTwo(computed.finalAmount + lineRoundOff),
        baseAmount: computed.finalAmount,
        lineRoundOff,
        gst: computed.gst,
        discountAmount: computed.discountAmount,
        totalWithGst: computed.totalWithGst,
      }
    }

    const taxable = meta.taxableTouched ? meta.editableTaxable : computed.amountBeforeGst
    const gst = calculateGST(taxable, item?.gstRate || 0, gstType)
    const totalWithGstP = Math.round(roundToTwo(taxable + gst.total) * 100)
    const discountP = Math.min(
      Math.max(0, Math.round(roundToTwo(Number(item?.discount) || 0) * 100)),
      totalWithGstP
    )
    const baseAmountP = totalWithGstP - discountP
    const amount = meta.amountTouched
      ? meta.editableAmount
      : (baseAmountP + lineRoundOffP) / 100

    return {
      taxable,
      amount,
      baseAmount: baseAmountP / 100,
      lineRoundOff,
      gst,
      discountAmount: discountP / 100,
      totalWithGst: totalWithGstP / 100,
    }
  }

  const addProductRow = () => {
    append({ productId: '', description: '', quantity: 1, rate: 0, discount: 0, roundOff: 0, gstRate: 18 })
  }

  const computeTotals = useCallback(() => {
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    let totalDiscount = 0
    let totalRoundOff = 0
    let total = 0
    fields.forEach((field, i) => {
      const eff = getEffectiveLine(field.id, i)
      taxable += eff.taxable
      cgst += eff.gst.cgst
      sgst += eff.gst.sgst
      igst += eff.gst.igst
      totalDiscount += eff.discountAmount
      totalRoundOff += eff.lineRoundOff
      total += eff.amount
    })
    return {
      taxable: roundToTwo(taxable),
      cgst,
      sgst,
      igst,
      totalDiscount: roundToTwo(totalDiscount),
      totalRoundOff: roundToTwo(totalRoundOff),
      grandTotal: roundToTwo(total),
    }
  }, [watchedItems, gstType, fields, itemMeta])

  const totals = computeTotals()

  useEffect(() => {
    setValue('roundOff', totals.totalRoundOff)
  }, [totals.totalRoundOff, setValue])

  const validateBeforeSubmit = (data: PurchaseInput): string | null => {
    const ids = data.items.map((i) => i.productId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return 'Duplicate products are not allowed'
    if (ids.length !== data.items.length) return 'Please select a product for every line item'
    if (!data.vendorId) return 'Please select a vendor from the list'

    const vendorErrors = validatePartyContactFields(vendorFields)
    setVendorContactErrors(vendorErrors)

    return firstPartyValidationError([{ fields: vendorFields, label: 'Vendor' }])
  }

  const onSubmit = async (data: PurchaseInput) => {
    const customError = validateBeforeSubmit(data)
    if (customError) {
      toast({ title: 'Validation', description: customError, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: PurchaseInput = {
        ...data,
        items: data.items.map((item, idx) => {
          const fieldId = fields[idx]?.id
          const meta = fieldId ? itemMeta[fieldId] : undefined
          return {
            ...item,
            ...(meta?.taxableTouched ? { taxableAmount: meta.editableTaxable } : {}),
            ...(meta?.amountTouched ? { amount: meta.editableAmount } : {}),
          }
        }),
      }
      const url = isEdit ? `/api/purchases/${purchaseId}` : '/api/purchases'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(typeof e.error === 'string' ? e.error : 'Failed')
      }
      toast({ title: isEdit ? 'Purchase updated successfully' : 'Purchase saved successfully' })
      router.push('/purchases')
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
        Loading purchase...
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-6xl min-w-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <Link href="/purchases">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">
            {isEdit ? 'Edit Purchase' : 'New Purchase'}
          </h1>
          {isEdit && purchaseNo && (
            <p className="text-sm text-muted-foreground">{purchaseNo}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" className="h-9" {...register('date')} />
                {errors.date && <p className="text-destructive text-xs">{String(errors.date.message)}</p>}
              </div>
              <div className="space-y-2">
                <Label>Bill Date</Label>
                <Input type="date" className="h-9" {...register('billDate')} />
              </div>
              <div className="space-y-2">
                <Label>Bill Number</Label>
                <Input className="h-9" {...register('billNo')} placeholder="Vendor bill number" />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={(v) => setValue('paymentMode', v as PurchaseInput['paymentMode'])}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </SelectContent>
                </Select>
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
                mobileError={vendorContactErrors.mobile}
                gstinError={vendorContactErrors.gstin}
              />
              <div className="space-y-2">
                <Label>GST Type</Label>
                <Select
                  value={gstType}
                  onValueChange={(v) => setValue('gstType', v as PurchaseInput['gstType'])}
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
              const eff = getEffectiveLine(field.id, i)
              const taxableDisplay = meta.taxableTouched
                ? meta.editableTaxable
                : eff.taxable
              const amountDisplay = meta.amountTouched ? meta.editableAmount : eff.amount

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

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-1 border-t border-dashed">
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
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-9 no-spinner pl-7"
                            value={Number.isFinite(taxableDisplay) ? taxableDisplay : ''}
                            onChange={(e) => handleTaxableEdit(field.id, i, e.target.value)}
                          />
                        </div>
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
                          type="text"
                          inputMode="decimal"
                          className="h-9"
                          value={
                            meta.discountDraft !== undefined
                              ? meta.discountDraft
                              : formatDiscountInputValue(item?.discount)
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.]/g, '')
                            updateItemMeta(field.id, { discountDraft: raw })
                            setValue(`items.${i}.discount`, parseDiscountInput(raw), {
                              shouldDirty: true,
                            })
                          }}
                          onBlur={() => {
                            const raw = meta.discountDraft
                            updateItemMeta(field.id, { discountDraft: undefined })
                            if (raw !== undefined) {
                              setValue(`items.${i}.discount`, parseDiscountInput(raw), {
                                shouldDirty: true,
                              })
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Round off Amt.</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                            ₹
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="h-9 pl-7"
                            placeholder="0"
                            value={
                              meta.roundOffDraft !== undefined
                                ? meta.roundOffDraft
                                : formatRoundOffInputValue(item?.roundOff)
                            }
                            onChange={(e) => {
                              const raw = sanitizeSignedDecimalInput(e.target.value)
                              const num = parseRoundOffInput(raw)
                              updateItemMeta(field.id, {
                                roundOffDraft: raw,
                                amountTouched: false,
                              })
                              setValue(`items.${i}.roundOff`, num, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }}
                            onBlur={() => {
                              const raw = meta.roundOffDraft
                              updateItemMeta(field.id, { roundOffDraft: undefined })
                              if (raw !== undefined) {
                                setValue(`items.${i}.roundOff`, parseRoundOffInput(raw), {
                                  shouldDirty: true,
                                })
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-9 no-spinner pl-7 font-semibold"
                            value={Number.isFinite(amountDisplay) ? amountDisplay : ''}
                            onChange={(e) => handleAmountEdit(field.id, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="border-t border-muted-foreground/20 px-4 py-3 flex justify-center sm:justify-end">
              <Button type="button" variant="outline" onClick={addProductRow} className="w-full sm:w-auto">
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
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Discount</span>
                <span className="font-medium text-orange-600">
                  -{formatCurrency(totals.totalDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Round Off</span>
              <span className="font-medium">
                {totals.totalRoundOff >= 0 ? '+' : ''}
                {formatCurrency(totals.totalRoundOff)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-3">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link href="/purchases" className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : isEdit ? 'Update Record' : 'Save Record'}
          </Button>
        </div>
      </form>
    </div>
  )
}
