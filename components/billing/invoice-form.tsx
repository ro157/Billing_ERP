'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceSchema, InvoiceInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Plus, Trash2, ArrowLeft, Loader2, Package } from 'lucide-react'
import {
  formatCurrency,
  calculateGST,
  roundToTwo,
  roundToNearestRupee,
  computeRoundOff,
  GST_RATES,
  cn,
} from '@/lib/utils'
import { parseQuotationPartyDetails } from '@/lib/quotation-party'

interface Product {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  selling_price: number
  gst_rate: number
  hsn_code?: string | null
  sac_code?: string | null
  current_stock: number
  low_stock_alert?: number | null
}

type ItemMeta = { hsnSac: string; productName: string; listOpen: boolean }
type PendingItemMetaRow = { productName: string; hsnSac: string }

const readOnlyInputClass = 'h-9 bg-muted/60 cursor-default'

function formatHsnSac(hsn: string | null | undefined, sac: string | null | undefined): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || ''
}

function computeInvoiceLineTotals(
  qty: number,
  rate: number,
  discountFlat: number,
  gstRate: number,
  gstType: InvoiceInput['gstType']
) {
  const taxableGross = roundToTwo((qty || 0) * (rate || 0))
  const gst = calculateGST(taxableGross, gstRate || 0, gstType || 'CGST_SGST')
  const totalWithGst = roundToTwo(taxableGross + gst.total)
  const discountAmount = roundToTwo(
    Math.min(Math.max(0, Number(discountFlat) || 0), totalWithGst)
  )
  const finalAmount = roundToTwo(totalWithGst - discountAmount)
  return { taxableGross, discountAmount, gst, totalWithGst, finalAmount }
}

interface Customer {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  billing_address?: string | null
  billing_city?: string | null
  shipping_address?: string | null
  shipping_city?: string | null
}

type PartyFields = {
  name: string
  contactPerson: string
  address: string
  mobile: string
  gstin: string
  pan: string
  city: string
}

const emptyParty: PartyFields = {
  name: '',
  contactPerson: '',
  address: '',
  mobile: '',
  gstin: '',
  pan: '',
  city: '',
}

function partiesMatch(a: PartyFields, b: PartyFields): boolean {
  return (
    a.name === b.name &&
    a.contactPerson === b.contactPerson &&
    a.address === b.address &&
    a.mobile === b.mobile &&
    a.gstin === b.gstin &&
    a.pan === b.pan &&
    a.city === b.city
  )
}

function customerToBuyer(c: Customer): PartyFields {
  return {
    name: c.name,
    contactPerson: c.contact_person || '',
    address: c.billing_address || '',
    mobile: c.mobile || c.phone || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    city: c.billing_city || '',
  }
}

function customerToConsignee(c: Customer): PartyFields {
  return {
    name: c.name,
    contactPerson: c.contact_person || '',
    address: c.shipping_address || c.billing_address || '',
    mobile: c.mobile || c.phone || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    city: c.shipping_city || c.billing_city || '',
  }
}

interface PartySectionProps {
  title: string
  fields: PartyFields
  onChange: <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => void
  disabled?: boolean
  contactLabel: string
  mobileLabel: string
  showCustomerSearch?: boolean
  customerListOpen?: boolean
  onCustomerNameChange?: (value: string) => void
  onCustomerFocus?: () => void
  filteredCustomers?: Customer[]
  onSelectCustomer?: (c: Customer) => void
  customerSearchRef?: React.RefObject<HTMLDivElement>
  customerError?: string
}

function PartySection({
  title,
  fields,
  onChange,
  disabled = false,
  contactLabel,
  mobileLabel,
  showCustomerSearch,
  customerListOpen,
  onCustomerNameChange,
  onCustomerFocus,
  filteredCustomers,
  onSelectCustomer,
  customerSearchRef,
  customerError,
}: PartySectionProps) {
  const inputClass = cn('h-9', disabled && 'bg-muted/60 cursor-not-allowed')

  return (
    <div className="space-y-4">
      {title ? (
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{title}</h3>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          className="sm:col-span-2 lg:col-span-3 space-y-2 relative"
          ref={showCustomerSearch ? customerSearchRef : undefined}
        >
          <Label>Customer Name *</Label>
          {showCustomerSearch ? (
            <>
              <Input
                value={fields.name}
                onChange={(e) => onCustomerNameChange?.(e.target.value)}
                onFocus={onCustomerFocus}
                placeholder="Type to search customer..."
                autoComplete="off"
                className={inputClass}
              />
              {customerListOpen && filteredCustomers && filteredCustomers.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelectCustomer?.(c)}
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
              {customerError && <p className="text-destructive text-xs">{customerError}</p>}
            </>
          ) : (
            <Input
              value={fields.name}
              onChange={(e) => onChange('name', e.target.value)}
              className={inputClass}
              disabled={disabled}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>{contactLabel}</Label>
          <Input
            value={fields.contactPerson}
            onChange={(e) => onChange('contactPerson', e.target.value)}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>{mobileLabel}</Label>
          <Input
            type="tel"
            value={fields.mobile}
            onChange={(e) => onChange('mobile', e.target.value)}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>GSTIN</Label>
          <Input
            value={fields.gstin}
            onChange={(e) => onChange('gstin', e.target.value.toUpperCase())}
            className={cn(inputClass, 'uppercase font-mono text-sm')}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input
            value={fields.pan}
            onChange={(e) => onChange('pan', e.target.value.toUpperCase())}
            className={cn(inputClass, 'uppercase font-mono text-sm')}
            maxLength={10}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={fields.city}
            onChange={(e) => onChange('city', e.target.value)}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 space-y-2">
          <Label>Address</Label>
          <Textarea
            rows={2}
            value={fields.address}
            onChange={(e) => onChange('address', e.target.value)}
            className={cn('min-h-[4rem] resize-none', disabled && 'bg-muted/60 cursor-not-allowed')}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.split('T')[0].split(' ')[0]
  return value.toISOString().split('T')[0]
}

export function InvoiceForm({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(invoiceId)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [buyerFields, setBuyerFields] = useState<PartyFields>(emptyParty)
  const [consigneeFields, setConsigneeFields] = useState<PartyFields>(emptyParty)
  const [sameAsBuyer, setSameAsBuyer] = useState(false)
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const [lastCustomer, setLastCustomer] = useState<Customer | null>(null)
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({})
  const [pendingItemMeta, setPendingItemMeta] = useState<PendingItemMetaRow[] | null>(null)
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const productSearchRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
  const { register, setValue, reset, formState: { errors } } = form

  const gstType = form.watch('gstType')
  const paymentMode = form.watch('paymentMode')
  const items = form.watch('items')

  const filteredCustomers = useMemo(() => {
    const q = buyerFields.name.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, buyerFields.name])

  useEffect(() => {
    if (isEdit) return
    Promise.all([
      fetch('/api/customers?limit=200').then((r) => r.json()),
      fetch('/api/products?limit=500').then((r) => r.json()),
    ]).then(([custs, prods]) => {
      setCustomers(custs.customers || [])
      setProducts(prods.products || [])
    })
  }, [isEdit])

  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false

    const load = async () => {
      setLoadingInitial(true)
      try {
        const [invRes, custRes, prodRes] = await Promise.all([
          fetch(`/api/invoices/${invoiceId}`),
          fetch('/api/customers?limit=200'),
          fetch('/api/products?limit=500'),
        ])
        if (!invRes.ok) throw new Error('Not found')
        const data = await invRes.json()
        const custData = await custRes.json()
        const prodData = await prodRes.json()
        if (cancelled) return

        const productList: Product[] = prodData.products || []
        const customerList: Customer[] = custData.customers || []
        setProducts(productList)
        setCustomers(customerList)
        setInvoiceNo(data.invoice_no || '')

        const linkedCustomer = customerList.find((c) => c.id === data.customer_id)
        const partyDetails = parseQuotationPartyDetails(data.party_details)
        const buyerFromDb = partyDetails?.buyer
        const consigneeFromDb = partyDetails?.consignee

        const buyer: PartyFields = {
          name: buyerFromDb?.name || data.customer_name || linkedCustomer?.name || '',
          contactPerson: buyerFromDb?.contactPerson || data.customer_contact_person || linkedCustomer?.contact_person || '',
          address: buyerFromDb?.address || data.billing_address || linkedCustomer?.billing_address || '',
          mobile: buyerFromDb?.mobile || data.customer_mobile || data.customer_phone || linkedCustomer?.mobile || linkedCustomer?.phone || '',
          gstin: buyerFromDb?.gstin || data.customer_gstin || linkedCustomer?.gstin || '',
          pan: buyerFromDb?.pan || data.customer_pan || linkedCustomer?.pan || '',
          city: buyerFromDb?.city || data.billing_city || linkedCustomer?.billing_city || '',
        }

        const consignee: PartyFields = {
          name: consigneeFromDb?.name || buyer.name,
          contactPerson: consigneeFromDb?.contactPerson || buyer.contactPerson,
          address:
            consigneeFromDb?.address ||
            data.customer_shipping_address ||
            linkedCustomer?.shipping_address ||
            buyer.address,
          mobile: consigneeFromDb?.mobile || buyer.mobile,
          gstin: consigneeFromDb?.gstin || buyer.gstin,
          pan: consigneeFromDb?.pan || buyer.pan,
          city: consigneeFromDb?.city || data.customer_shipping_city || linkedCustomer?.shipping_city || buyer.city,
        }

        setBuyerFields(buyer)
        setConsigneeFields(consignee)
        setSameAsBuyer(partiesMatch(buyer, consignee))

        const formItems = (data.items || []).length > 0
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
              gstRate: Number(item.gst_rate),
            }))
          : [{ productId: '', quantity: 1, rate: 0, discount: 0, gstRate: 18 }]

        const metaRows: PendingItemMetaRow[] = formItems.map((item) => {
          const p = productList.find((x) => x.id === item.productId)
          return {
            productName: p?.name ?? '',
            hsnSac: p ? formatHsnSac(p.hsn_code, p.sac_code) : '',
          }
        })

        reset({
          customerId: data.customer_id,
          date: toDateInput(data.date) || new Date().toISOString().split('T')[0],
          dueDate: toDateInput(data.due_date),
          gstType: data.gst_type || 'CGST_SGST',
          placeOfSupply: data.place_of_supply || undefined,
          paymentMode: data.payment_mode || 'CASH',
          paidAmount: Number(data.paid_amount) || 0,
          notes: data.notes || undefined,
          terms: data.terms || undefined,
          items: formItems,
        })
        setPendingItemMeta(metaRows.length > 0 ? metaRows : null)
      } catch {
        if (cancelled) return
        toast({ title: 'Error', description: 'Could not load invoice', variant: 'destructive' })
        router.push('/billing')
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [invoiceId, reset, router, toast])

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

  // Edit mode fallback: if meta hydration missed, derive productName/HSN from products list.
  useEffect(() => {
    if (!isEdit || !products.length) return
    setItemMeta((prev) => {
      const next = { ...prev }
      let changed = false
      fields.forEach((field, i) => {
        const productId = items?.[i]?.productId
        if (!productId) return
        const product = products.find((p) => p.id === productId)
        if (!product) return
        const cur = next[field.id] || { hsnSac: '', productName: '', listOpen: false }
        if (cur.productName) return
        next[field.id] = {
          ...cur,
          productName: product.name,
          hsnSac: formatHsnSac(product.hsn_code, product.sac_code),
        }
        changed = true

        // If invoice_items.description is empty, fill from product master (same as create flow).
        const curDesc = items?.[i]?.description
        if (!curDesc) {
          setValue(`items.${i}.description`, product.description || product.name)
        }
      })
      return changed ? next : prev
    })
  }, [isEdit, products, fields, items, setValue])

  const applyCustomer = useCallback(
    (c: Customer) => {
      form.setValue('customerId', c.id, { shouldValidate: true })
      const buyer = customerToBuyer(c)
      setBuyerFields(buyer)
      setLastCustomer(c)
      // Only copy to consignee if user explicitly opted-in
      if (sameAsBuyer) setConsigneeFields(buyer)
      setCustomerListOpen(false)
    },
    [form, sameAsBuyer]
  )

  const updateBuyerField = <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => {
    // Do NOT keep syncing consignee on every buyer edit; user wants consignee editable.
    setBuyerFields((prev) => ({ ...prev, [key]: value }))
  }

  const updateConsigneeField = <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => {
    setConsigneeFields((prev) => ({ ...prev, [key]: value }))
  }

  const handleBuyerNameChange = (value: string) => {
    setBuyerFields((prev) => ({ ...prev, name: value }))
    setCustomerListOpen(true)
    const match = customers.find((c) => c.name === value)
    if (match) {
      applyCustomer(match)
    } else {
      form.setValue('customerId', '')
    }
  }

  const handleSameAsBuyerChange = (checked: boolean) => {
    setSameAsBuyer(checked)
    // When checked: copy current buyer snapshot, but keep fields editable afterwards.
    if (checked) setConsigneeFields(buyerFields)
  }

  // NOTE: react-hook-form may mutate the `items` array in-place, so useMemo([items]) can go stale.
  // Compute totals on every render to keep summary + round-off accurate.
  const computedTotals = (() => {
    let subtotal = 0
    let totalDiscount = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let grandTotalBeforeRound = 0

    items?.forEach((item) => {
      const line = computeInvoiceLineTotals(
        item?.quantity || 0,
        item?.rate || 0,
        item?.discount || 0,
        item?.gstRate || 0,
        gstType
      )
      subtotal += line.taxableGross
      totalDiscount += line.discountAmount
      totalCgst += line.gst.cgst
      totalSgst += line.gst.sgst
      totalIgst += line.gst.igst
      grandTotalBeforeRound += line.finalAmount
    })

    const taxAmount = roundToTwo(totalCgst + totalSgst + totalIgst)
    const roundOff = computeRoundOff(grandTotalBeforeRound)
    const totalAmount = roundToNearestRupee(grandTotalBeforeRound)

    return {
      subtotal: roundToTwo(subtotal),
      totalDiscount: roundToTwo(totalDiscount),
      totalCgst: roundToTwo(totalCgst),
      totalSgst: roundToTwo(totalSgst),
      totalIgst: roundToTwo(totalIgst),
      taxAmount,
      grandTotalBeforeRound: roundToTwo(grandTotalBeforeRound),
      roundOff,
      totalAmount,
    }
  })()

  const getUsedProductIds = (excludeIndex: number) => {
    const ids = new Set<string>()
    items?.forEach((item, idx) => {
      if (idx !== excludeIndex && item?.productId) ids.add(item.productId)
    })
    return ids
  }

  const getFilteredProducts = (index: number, query: string) => {
    const used = getUsedProductIds(index)
    const currentId = items?.[index]?.productId
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

  const addProductCard = () => {
    append({ productId: '', quantity: 1, rate: 0, discount: 0, gstRate: 18 })
  }

  const validateBeforeSubmit = (data: InvoiceInput): string | null => {
    const ids = data.items.map((i) => i.productId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return 'Duplicate products are not allowed'
    if (ids.length !== data.items.length) return 'Please select a product for every line item'
    if (!data.customerId) return 'Please select a customer from the list'
    return null
  }

  const onSubmit = async (data: InvoiceInput) => {
    const customError = validateBeforeSubmit(data)
    if (customError) {
      toast({ title: 'Validation', description: customError, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: InvoiceInput = {
        ...data,
        partyDetails: {
          buyer: buyerFields,
          consignee: consigneeFields,
        },
      }
      const url = isEdit ? `/api/invoices/${invoiceId}` : '/api/invoices'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to save invoice')
      }
      toast({ title: isEdit ? 'Invoice updated successfully' : 'Invoice created successfully' })
      router.push('/billing')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading invoice...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/billing">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {isEdit ? 'Edit Invoice' : 'New Invoice'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit && invoiceNo ? invoiceNo : 'Create a GST sales invoice'}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" className="h-9" {...form.register('date')} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" className="h-9" {...form.register('dueDate')} />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={paymentMode || 'CASH'} onValueChange={(v) => form.setValue('paymentMode', v as InvoiceInput['paymentMode'])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                <Label>GST Type *</Label>
                <Select value={gstType || 'CGST_SGST'} onValueChange={(v) => form.setValue('gstType', v as InvoiceInput['gstType'])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CGST_SGST">CGST + SGST (Intra-state)</SelectItem>
                    <SelectItem value="IGST">IGST (Inter-state)</SelectItem>
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
          <CardContent className="space-y-6">
            <PartySection
              title="Billed to (Buyer)"
              fields={buyerFields}
              onChange={updateBuyerField}
              contactLabel="B. Person"
              mobileLabel="Mob"
              showCustomerSearch
              customerListOpen={customerListOpen}
              onCustomerNameChange={handleBuyerNameChange}
              onCustomerFocus={() => setCustomerListOpen(true)}
              filteredCustomers={filteredCustomers}
              onSelectCustomer={applyCustomer}
              customerSearchRef={customerSearchRef}
              customerError={form.formState.errors.customerId?.message}
            />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-700">Shipped to (Consignee)</h3>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsBuyer}
                    onChange={(e) => handleSameAsBuyerChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                  />
                  <span className="text-muted-foreground">Same as buyer</span>
                </label>
              </div>
              <PartySection
                title=""
                fields={consigneeFields}
                onChange={updateConsigneeField}
                contactLabel="S. Person"
                mobileLabel="Mobile"
              />
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
              const item = items?.[i]
              const meta = itemMeta[field.id] || { hsnSac: '', productName: '', listOpen: false }
              const filteredProducts = getFilteredProducts(i, meta.productName)

              const line = computeInvoiceLineTotals(
                item?.quantity || 0,
                item?.rate || 0,
                item?.discount || 0,
                item?.gstRate || 0,
                gstType
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

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_1fr] gap-4">
              <div className="space-y-2">
                <Label>Paid Amount (₹)</Label>
                <Input type="number" step="0.01" className="h-9" {...form.register('paidAmount', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input className="h-9" placeholder="Optional notes..." {...form.register('notes')} />
              </div>
            </div>
            <Separator />
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-2">
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
                {computedTotals.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Discount</span>
                    <span className="text-orange-600">-{formatCurrency(computedTotals.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Round Off</span>
                  <span className="font-medium">
                    {computedTotals.roundOff >= 0 ? '+' : ''}
                    {formatCurrency(computedTotals.roundOff)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span>{formatCurrency(computedTotals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEdit ? 'Updating...' : 'Creating...'}</>
            ) : (
              isEdit ? 'Update Invoice' : 'Create Invoice'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
