'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'
import { businessSettingsSchema, type BusinessSettingsInput } from '@/lib/validations'
import { INDIAN_STATES } from '@/lib/utils'

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: { companyName: '', invoicePrefix: 'INV', quotPrefix: 'QT', poPrefix: 'PO', challanPrefix: 'DC' }
  })

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data) reset({
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
        invoicePrefix: data.invoice_prefix || data.invoicePrefix || 'INV',
        poPrefix: data.po_prefix || data.poPrefix || 'PO',
        quotPrefix: data.quot_prefix || data.quotPrefix || 'QT',
        challanPrefix: data.challan_prefix || data.challanPrefix || 'DC',
        termsCondition: data.terms_condition || data.termsCondition || '',
      })
      setLoading(false)
    })
  }, [reset])

  const onSubmit = async (data: BusinessSettingsInput) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Settings saved' })
    } catch {
      toast({ title: 'Error saving settings', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-muted-foreground">Loading settings...</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Business Settings</h1>
        <p className="text-muted-foreground">Configure your company information</p>
      </div>

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
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input {...register('gstin')} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="space-y-2">
                <Label>PAN</Label>
                <Input {...register('pan')} placeholder="AAAAA0000A" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...register('phone')} placeholder="+91 98765 43210" />
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
              <Textarea {...register('address')} placeholder="Street address" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input {...register('city')} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select onValueChange={(v) => setValue('state', v)}>
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
                <Input {...register('invoicePrefix')} placeholder="INV" />
              </div>
              <div className="space-y-2">
                <Label>Quotation Prefix</Label>
                <Input {...register('quotPrefix')} placeholder="QT" />
              </div>
              <div className="space-y-2">
                <Label>Purchase Order Prefix</Label>
                <Input {...register('poPrefix')} placeholder="PO" />
              </div>
              <div className="space-y-2">
                <Label>Challan Prefix</Label>
                <Input {...register('challanPrefix')} placeholder="DC" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Terms & Conditions</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register('termsCondition')} rows={4} placeholder="Enter terms and conditions to print on invoices..." />
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  )
}
