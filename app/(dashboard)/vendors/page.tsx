'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vendorSchema, VendorInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Edit, Eye, Trash2, Truck, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { sanitizeGstinInput, sanitizeMobileInput } from '@/lib/field-validation'
import { ListPageToolbar } from '@/components/shared/list-page-toolbar'
import { parseJsonResponse } from '@/lib/fetch-json'

interface Vendor {
  id: string
  name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
}

interface VendorPurchase {
  id: string
  purchase_no: string
  date: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  status: string
}

type VendorDetail = Vendor & { purchases?: VendorPurchase[] }

const emptyFormValues: VendorInput = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  gstin: '',
  pan: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  creditLimit: 0,
  openingBalance: 0,
  isActive: true,
}

function formatApiError(error: unknown): string {
  if (typeof error === 'string') return error
  if (Array.isArray(error)) {
    return error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || 'Validation failed'
  }
  return 'Something went wrong'
}

function vendorToFormValues(v: Vendor): VendorInput {
  return {
    name: v.name,
    contactPerson: v.contact_person || '',
    email: v.email || '',
    phone: v.phone || v.mobile || '',
    gstin: v.gstin || '',
    pan: v.pan || '',
    address: v.address || '',
    city: v.city || '',
    state: v.state || '',
    pincode: v.pincode || '',
    creditLimit: 0,
    openingBalance: 0,
    isActive: true,
  }
}

function VendorActions({
  onView,
  onEdit,
  onDelete,
  compact = false,
}: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const size = compact ? 'h-7 w-7' : 'h-8 w-8'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className="flex items-center justify-end gap-0 shrink-0">
      <Button variant="ghost" size="icon" title="View" className={size} onClick={onView}>
        <Eye className={icon} />
      </Button>
      <Button variant="ghost" size="icon" title="Edit" className={size} onClick={onEdit}>
        <Edit className={icon} />
      </Button>
      <Button variant="ghost" size="icon" title="Delete" className={`${size} text-destructive hover:text-destructive`} onClick={onDelete}>
        <Trash2 className={icon} />
      </Button>
    </div>
  )
}

export default function VendorsPage() {
  const { toast } = useToast()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewing, setViewing] = useState<VendorDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: emptyFormValues,
  })

  const showTable = viewMode === 'table' && !isMobile
  const showCards = viewMode === 'card' || isMobile

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/vendors?${params}`)
      const data = await parseJsonResponse<{ vendors?: Vendor[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load vendors', variant: 'destructive' })
        return
      }
      setVendors(data.vendors || [])
      setTotal(Number(data.total) || 0)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load vendors'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const openNew = () => {
    setEditing(null)
    form.reset(emptyFormValues)
    setDialogOpen(true)
  }

  const openView = async (v: Vendor) => {
    setViewDialogOpen(true)
    setViewLoading(true)
    setViewing(v)
    try {
      const res = await fetch(`/api/vendors/${v.id}`)
      if (res.ok) setViewing(await parseJsonResponse<VendorDetail>(res))
    } finally {
      setViewLoading(false)
    }
  }

  const openEditFromView = () => {
    if (!viewing) return
    setViewDialogOpen(false)
    openEdit(viewing)
  }

  const openEdit = (v: Vendor) => {
    setEditing(v)
    form.reset(vendorToFormValues(v))
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete vendor "${name}"?`)) return
    const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Vendor deleted' })
      fetchVendors()
    } else {
      const err = await parseJsonResponse<{ error?: string }>(res)
      toast({ title: 'Error', description: err.error || 'Cannot delete', variant: 'destructive' })
    }
  }

  const onSubmit = async (data: VendorInput) => {
    setSaving(true)
    try {
      const url = editing ? `/api/vendors/${editing.id}` : '/api/vendors'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: unknown }>(res)
        toast({ title: 'Error', description: formatApiError(err.error), variant: 'destructive' })
        return
      }
      toast({ title: editing ? 'Vendor updated' : 'Vendor created' })
      setDialogOpen(false)
      fetchVendors()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const Pagination = () =>
    total > 20 ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-t">
        <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    ) : null

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <div className="min-w-0">
        <p className="text-sm sm:text-base text-muted-foreground">{total} vendor(s)</p>
      </div>

      <ListPageToolbar
        searchPlaceholder="Search vendors..."
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        addLabel="Add Vendor"
        onAddClick={openNew}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {showTable && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : vendors.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No vendors found</TableCell></TableRow>
              ) : (
                vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Truck className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="font-medium">{v.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{v.contact_person || '-'}</TableCell>
                    <TableCell>{v.phone || v.mobile || '-'}</TableCell>
                    <TableCell>{v.email || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{v.gstin || '-'}</TableCell>
                    <TableCell>{[v.city, v.state].filter(Boolean).join(', ') || '-'}</TableCell>
                    <TableCell className="text-right">
                      <VendorActions
                        onView={() => openView(v)}
                        onEdit={() => openEdit(v)}
                        onDelete={() => handleDelete(v.id, v.name)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination />
        </Card>
      )}

      {showCards && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : vendors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No vendors found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {vendors.map((v) => (
                <Card key={v.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug break-words">{v.name}</p>
                            {v.contact_person && (
                              <p className="text-xs text-muted-foreground mt-0.5">{v.contact_person}</p>
                            )}
                          </div>
                        </div>
                        <VendorActions
                          compact
                          onView={() => openView(v)}
                          onEdit={() => openEdit(v)}
                          onDelete={() => handleDelete(v.id, v.name)}
                        />
                      </div>

                      <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Phone</span>
                          <span className="font-medium text-sm">{v.phone || v.mobile || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Email</span>
                          <span className="font-medium text-sm truncate text-right max-w-[55%]">{v.email || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">GSTIN</span>
                          <span className="font-mono text-xs font-medium">{v.gstin || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2.5 rounded-b-xl">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground shrink-0">Location</span>
                      <span className="ml-auto min-w-0 truncate text-right text-sm font-medium">
                        {[v.city, v.state].filter(Boolean).join(', ') || '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {total > 20 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-lg max-h-[92dvh] overflow-hidden flex flex-col gap-0 p-0 rounded-xl sm:rounded-2xl !top-3 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">Vendor Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {viewLoading && !viewing ? (
              <p className="py-8 text-center text-muted-foreground">Loading...</p>
            ) : viewing ? (
              <div className="space-y-4 py-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Vendor Name</p>
                    <p className="font-medium">{viewing.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact Person</p>
                    <p>{viewing.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p>{viewing.phone || viewing.mobile || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="break-all">{viewing.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GSTIN</p>
                    <p className="font-mono text-xs">{viewing.gstin || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN</p>
                    <p className="font-mono text-xs">{viewing.pan || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="whitespace-pre-wrap">{viewing.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p>{viewing.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State</p>
                    <p>{viewing.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pincode</p>
                    <p>{viewing.pincode || '-'}</p>
                  </div>
                </div>
                {viewing.purchases && viewing.purchases.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Purchases</p>
                    <div className="border rounded-lg divide-y text-sm">
                      {viewing.purchases.map((p) => (
                        <div key={p.id} className="flex justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.purchase_no}</p>
                            <p className="text-xs text-muted-foreground">{p.date}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium">{formatCurrency(Number(p.total_amount))}</p>
                            <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-row gap-2 border-t px-3 py-2.5 sm:px-4 rounded-b-xl sm:rounded-b-2xl">
            <Button variant="outline" className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={openEditFromView} disabled={!viewing}>Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-0.75rem)] max-w-xl !flex !flex-col gap-0 overflow-hidden p-0 rounded-xl sm:rounded-2xl sm:w-full !top-3 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%]">
          <DialogHeader className="shrink-0 space-y-0 px-3 pb-2 pt-3 pr-11 text-left sm:px-6 sm:pt-5 sm:pr-14">
            <DialogTitle className="text-base sm:text-lg">{editing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1 sm:px-6 sm:py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 pb-1">
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">Vendor Name *</Label>
                  <Input className="h-9" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">Contact Person *</Label>
                  <Input className="h-9" {...form.register('contactPerson')} />
                  {form.formState.errors.contactPerson && (
                    <p className="text-destructive text-xs">{form.formState.errors.contactPerson.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">Phone *</Label>
                  <Input
                    className="h-9"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    {...form.register('phone', {
                      setValueAs: (v) => sanitizeMobileInput(String(v ?? '')),
                    })}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-destructive text-xs">{form.formState.errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">Email</Label>
                  <Input type="email" className="h-9" {...form.register('email')} />
                  {form.formState.errors.email && (
                    <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">GSTIN *</Label>
                  <Input
                    className="h-9 uppercase font-mono text-sm"
                    maxLength={15}
                    {...form.register('gstin', {
                      setValueAs: (v) => sanitizeGstinInput(String(v ?? '')),
                    })}
                  />
                  {form.formState.errors.gstin && (
                    <p className="text-destructive text-xs">{form.formState.errors.gstin.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">PAN</Label>
                  <Input className="h-9 uppercase" placeholder="Optional" {...form.register('pan')} />
                  {form.formState.errors.pan && (
                    <p className="text-destructive text-xs">{form.formState.errors.pan.message}</p>
                  )}
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">Address *</Label>
                  <Textarea
                    rows={3}
                    placeholder="Vendor address"
                    className="min-h-[4.5rem] resize-none sm:min-h-[5rem]"
                    {...form.register('address')}
                  />
                  {form.formState.errors.address && (
                    <p className="text-destructive text-xs">{form.formState.errors.address.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">Pincode</Label>
                  <Input className="h-9" {...form.register('pincode')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">City</Label>
                  <Input className="h-9" {...form.register('city')} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">State</Label>
                  <Input className="h-9 sm:max-w-[calc(50%-0.5rem)]" {...form.register('state')} />
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-row gap-2 border-t bg-background px-3 py-2.5 sm:px-6 sm:py-3 rounded-b-xl sm:rounded-b-2xl">
              <Button type="button" variant="outline" className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-9 sm:flex-none sm:w-auto" disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
