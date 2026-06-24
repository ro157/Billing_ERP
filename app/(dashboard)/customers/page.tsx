'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, CustomerInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { usePageCount } from '@/hooks/use-page-count'
import { Edit, Eye, Trash2, User, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { sanitizeGstinInput, sanitizeMobileInput } from '@/lib/field-validation'
import { ListPageToolbar } from '@/components/shared/list-page-toolbar'
import { parseJsonResponse } from '@/lib/fetch-json'

interface Customer {
  id: string
  name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_pincode?: string | null
}

interface CustomerInvoice {
  id: string
  invoice_no: string
  date: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  status: string
}

type CustomerDetail = Customer & { invoices?: CustomerInvoice[] }

const emptyFormValues: CustomerInput = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  gstin: '',
  pan: '',
  billingAddress: '',
  billingCity: '',
  billingState: '',
  billingPincode: '',
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

function customerToFormValues(c: Customer): CustomerInput {
  return {
    name: c.name,
    contactPerson: c.contact_person || '',
    email: c.email || '',
    phone: c.phone || c.mobile || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    billingAddress: c.billing_address || '',
    billingCity: c.billing_city || '',
    billingState: c.billing_state || '',
    billingPincode: c.billing_pincode || '',
    creditLimit: 0,
    openingBalance: 0,
    isActive: true,
  }
}

function CustomerActions({
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

export default function CustomersPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  usePageCount(`${total} customer(s)`)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewing, setViewing] = useState<CustomerDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/customers?${params}`)
      const data = await parseJsonResponse<{ customers?: Customer[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load customers', variant: 'destructive' })
        return
      }
      setCustomers(data.customers || [])
      setTotal(Number(data.total) || 0)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load customers'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const openNew = () => {
    setEditing(null)
    form.reset(emptyFormValues)
    setDialogOpen(true)
  }

  const openView = async (c: Customer) => {
    setViewDialogOpen(true)
    setViewLoading(true)
    setViewing(c)
    try {
      const res = await fetch(`/api/customers/${c.id}`)
      if (res.ok) setViewing(await parseJsonResponse<CustomerDetail>(res))
    } finally {
      setViewLoading(false)
    }
  }

  const openEditFromView = () => {
    if (!viewing) return
    setViewDialogOpen(false)
    openEdit(viewing)
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    form.reset(customerToFormValues(c))
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Customer deleted' })
      fetchCustomers()
    } else {
      const err = await parseJsonResponse<{ error?: string }>(res)
      toast({ title: 'Error', description: err.error || 'Cannot delete', variant: 'destructive' })
    }
  }

  const onSubmit = async (data: CustomerInput) => {
    setSaving(true)
    try {
      const url = editing ? `/api/customers/${editing.id}` : '/api/customers'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: unknown }>(res)
        toast({ title: 'Error', description: formatApiError(err.error), variant: 'destructive' })
        return
      }
      toast({
        title: editing ? 'Customer updated' : 'Customer created',
        description: editing ? 'Customer details saved successfully.' : undefined,
      })
      setDialogOpen(false)
      fetchCustomers()
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
      <ListPageToolbar
        searchPlaceholder="Search customers..."
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        addLabel="Add Customer"
        onAddClick={openNew}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {showTable && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
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
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No customers found</TableCell></TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{c.contact_person || '-'}</TableCell>
                    <TableCell>{c.phone || c.mobile || '-'}</TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin || '-'}</TableCell>
                    <TableCell>{[c.billing_city, c.billing_state].filter(Boolean).join(', ') || '-'}</TableCell>
                    <TableCell className="text-right">
                      <CustomerActions
                        onView={() => openView(c)}
                        onEdit={() => openEdit(c)}
                        onDelete={() => handleDelete(c.id, c.name)}
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
          ) : customers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No customers found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {customers.map((c) => (
                <Card key={c.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-snug break-words">{c.name}</p>
                            {c.contact_person && (
                              <p className="text-xs text-muted-foreground mt-0.5">{c.contact_person}</p>
                            )}
                          </div>
                        </div>
                        <CustomerActions
                          compact
                          onView={() => openView(c)}
                          onEdit={() => openEdit(c)}
                          onDelete={() => handleDelete(c.id, c.name)}
                        />
                      </div>

                      <div className="mt-2 space-y-1.5 text-sm border-t pt-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Phone</span>
                          <span className="font-medium text-sm">{c.phone || c.mobile || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Email</span>
                          <span className="font-medium text-sm truncate text-right max-w-[55%]">{c.email || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">GSTIN</span>
                          <span className="font-mono text-xs font-medium">{c.gstin || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2.5 rounded-b-xl">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground shrink-0">Location</span>
                      <span className="ml-auto min-w-0 truncate text-right text-sm font-medium">
                        {[c.billing_city, c.billing_state].filter(Boolean).join(', ') || '-'}
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
            <DialogTitle className="text-base">Customer Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {viewLoading && !viewing ? (
              <p className="py-8 text-center text-muted-foreground">Loading...</p>
            ) : viewing ? (
              <div className="space-y-4 py-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Customer Name</p>
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
                    <p className="whitespace-pre-wrap">{viewing.billing_address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p>{viewing.billing_city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State</p>
                    <p>{viewing.billing_state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pincode</p>
                    <p>{viewing.billing_pincode || '-'}</p>
                  </div>
                </div>
                {viewing.invoices && viewing.invoices.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Invoices</p>
                    <div className="border rounded-lg divide-y text-sm">
                      {viewing.invoices.map((inv) => (
                        <div key={inv.id} className="flex justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{inv.invoice_no}</p>
                            <p className="text-xs text-muted-foreground">{inv.date}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium">{formatCurrency(Number(inv.total_amount))}</p>
                            {Number(inv.balance_amount) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Due: {formatCurrency(Number(inv.balance_amount))}
                              </p>
                            )}
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
            <DialogTitle className="text-base sm:text-lg">{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1 sm:px-6 sm:py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 pb-1">
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">Customer Name *</Label>
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
                    placeholder="Billing address"
                    className="min-h-[4.5rem] resize-none sm:min-h-[5rem]"
                    {...form.register('billingAddress')}
                  />
                  {form.formState.errors.billingAddress && (
                    <p className="text-destructive text-xs">{form.formState.errors.billingAddress.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">Pincode</Label>
                  <Input className="h-9" {...form.register('billingPincode')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">City</Label>
                  <Input className="h-9" {...form.register('billingCity')} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label className="text-xs sm:text-sm">State</Label>
                  <Input className="h-9 sm:max-w-[calc(50%-0.5rem)]" {...form.register('billingState')} />
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
