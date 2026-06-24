'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'
import { businessSettingsSchema, type BusinessSettingsInput } from '@/lib/validations'
import { INDIAN_STATES } from '@/lib/utils'
import { DocumentHeaderPreview } from '@/components/settings/document-header-preview'
import { sanitizeGstinInput, sanitizeMobileInput } from '@/lib/field-validation'
import { DOCUMENT_TERMS_MODULES } from '@/lib/document-terms'
import {
  DEFAULT_SIDEBAR_COLOR,
  SIDEBAR_COLOR_PRESETS,
  isValidHexColor,
  applyOrgTheme,
} from '@/lib/theme'


export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      companyName: '',
      invoicePrefix: 'VE',
      quotationPrefix: 'QT',
      purchaseOrderPrefix: 'PO',
      challanPrefix: 'DC',
      sidebarColor: DEFAULT_SIDEBAR_COLOR,
    }
  })

  // Watch all fields for real-time preview updates
  const watchedValues = watch()

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data) {
        reset({
          companyName: data.company_name || data.companyName || '',
          gstin: data.gstin || '',
          pan: data.pan || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          bankName: data.bank_name || data.bankName || '',
          bankAccount: data.bank_account || data.bankAccount || '',
          bankIfsc: data.bank_ifsc || data.bankIfsc || '',
          bankBranch: data.bank_branch || data.bankBranch || '',
          invoicePrefix: data.invoice_prefix || data.invoicePrefix || 'VE',
          quotationPrefix: data.quotation_prefix || data.quotationPrefix || 'QT',
          purchaseOrderPrefix: data.purchase_order_prefix || data.purchaseOrderPrefix || 'PO',
          challanPrefix: data.challan_prefix || data.challanPrefix || 'DC',
          quotationTerms: data.quotation_terms || data.quotationTerms || data.terms_condition || data.termsCondition || '',
          salesInvoiceTerms: data.sales_invoice_terms || data.salesInvoiceTerms || data.terms_condition || data.termsCondition || '',
          purchaseOrderTerms: data.purchase_order_terms || data.purchaseOrderTerms || data.terms_condition || data.termsCondition || '',
          purchaseInvoiceTerms: data.purchase_invoice_terms || data.purchaseInvoiceTerms || data.terms_condition || data.termsCondition || '',
          deliveryChallanTerms: data.delivery_challan_terms || data.deliveryChallanTerms || data.terms_condition || data.termsCondition || '',
          returnableChallanTerms: data.returnable_challan_terms || data.returnableChallanTerms || data.terms_condition || data.termsCondition || '',
          sidebarColor: data.sidebarColor || data.sidebar_color || DEFAULT_SIDEBAR_COLOR,
        })
        setLogoPreview(data.logo || null)
      }
      setLoading(false)
    })
  }, [reset])

  useEffect(() => {
    if (isValidHexColor(watchedValues.sidebarColor)) {
      applyOrgTheme(watchedValues.sidebarColor)
    }
  }, [watchedValues.sidebarColor])

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoPreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read file'))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  const onSubmit = async (data: BusinessSettingsInput) => {
    setSaving(true)
    try {
      const payload: any = { ...data }
      if (logoFile) {
        payload.logo = await fileToDataUrl(logoFile)
      }

      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed')
      window.dispatchEvent(new Event('branding-updated'))
      toast({ title: 'Settings saved', description: 'Your changes have been applied.' })
    } catch {
      toast({ title: 'Error saving settings', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-muted-foreground">Loading settings...</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-muted-foreground">Configure your company information</p>
      </div>

      {/* Document Header Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Header Preview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Live preview of your letterhead — updates as you edit company details below
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DocumentHeaderPreview {...watchedValues} logoPreview={logoPreview} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Invoice / quotation body appears below this header on printed documents
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Company Name *</Label>
                <Input {...register('companyName')} placeholder="Your Company Name" />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Company Icon</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Company icon preview" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500">No icon selected</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input type="file" accept="image/*" onChange={handleLogoChange} />
                    <p className="text-sm text-muted-foreground">Upload a PNG, JPG, or SVG company icon.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input
                  className="uppercase font-mono text-sm"
                  maxLength={15}
                  placeholder="22AAAAA0000A1Z5"
                  {...register('gstin', {
                    setValueAs: (v) => sanitizeGstinInput(String(v ?? '')),
                  })}
                />
                {errors.gstin && (
                  <p className="text-destructive text-xs">{errors.gstin.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>PAN</Label>
                <Input {...register('pan')} placeholder="AAAAA0000A" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  {...register('phone', {
                    setValueAs: (v) => sanitizeMobileInput(String(v ?? '')),
                  })}
                />
                {errors.phone && (
                  <p className="text-destructive text-xs">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...register('email')} placeholder="info@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input {...register('website')} placeholder="https://company.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                {...register('address')}
                placeholder={'25/2, Street -2, 1st Floor, Molarband Market,\nBeside Om TVS bike Showroom, Badarpur'}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Use separate lines for each address line (city/state/pincode go in fields below).</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input {...register('city')} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={watchedValues.state || ''} onValueChange={(v) => setValue('state', v)}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input {...register('pincode')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Theme</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick your brand color — it applies to the sidebar, menu highlights, Save buttons, and
              all primary actions across modules
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={isValidHexColor(watchedValues.sidebarColor) ? watchedValues.sidebarColor! : DEFAULT_SIDEBAR_COLOR}
                  onChange={(e) => setValue('sidebarColor', e.target.value, { shouldDirty: true })}
                  className="h-11 w-14 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                  aria-label="Pick theme color"
                />
                <Input
                  value={watchedValues.sidebarColor || DEFAULT_SIDEBAR_COLOR}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.length <= 7) setValue('sidebarColor', v, { shouldDirty: true })
                  }}
                  placeholder="#0f172a"
                  className="w-32 font-mono uppercase"
                  maxLength={7}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue('sidebarColor', DEFAULT_SIDEBAR_COLOR, { shouldDirty: true })}
                >
                  Reset
                </Button>
              </div>
              {errors.sidebarColor && (
                <p className="text-sm text-destructive">{errors.sidebarColor.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Quick presets</Label>
              <div className="flex flex-wrap gap-2">
                {SIDEBAR_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => setValue('sidebarColor', preset.value, { shouldDirty: true })}
                    className="h-9 w-9 rounded-md border-2 border-white shadow ring-1 ring-slate-200 transition-transform hover:scale-105"
                    style={{ backgroundColor: preset.value }}
                    aria-label={`${preset.name} theme color`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Banking Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input {...register('bankName')} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input {...register('bankAccount')} />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input {...register('bankIfsc')} />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input {...register('bankBranch')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Document Number Prefixes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Prefix</Label>
                <Input {...register('invoicePrefix')} placeholder="VE" />
              </div>
              <div className="space-y-2">
                <Label>Quotation Prefix</Label>
                <Input {...register('quotationPrefix')} placeholder="QT" />
              </div>
              <div className="space-y-2">
                <Label>Purchase Order Prefix</Label>
                <Input {...register('purchaseOrderPrefix')} placeholder="PO" />
              </div>
              <div className="space-y-2">
                <Label>Challan Prefix</Label>
                <Input {...register('challanPrefix')} placeholder="DC" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Terms & Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Default terms printed on each document type. You can still override per document when creating or editing.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DOCUMENT_TERMS_MODULES.map((module) => (
                <div key={module.field} className="space-y-2">
                  <Label>{module.label}</Label>
                  <Textarea
                    {...register(module.field)}
                    rows={3}
                    placeholder={module.placeholder}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  )
}
