'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { Search, RefreshCw, Ban, CheckCircle, Pencil, Eye } from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  phone: string | null
  address: string | null
  state: string | null
  pincode: string | null
  ownerName: string | null
  ownerEmail: string | null
  createdAt: string
  memberCount: number
  invoiceCount: number
  productCount: number
  companyName: string | null
  gstin: string | null
}

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  status: string
  created_at: string
}

interface OrgDetails {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  createdAt: string
  updatedAt: string
  memberCount: number
  invoiceCount: number
  productCount: number
  companyName: string | null
  gstin: string | null
  companyEmail: string | null
  companyPhone: string | null
  companyAddress: string | null
  companyCity: string | null
  companyState: string | null
  companyPincode: string | null
  ownerName: string | null
  ownerEmail: string | null
}

function statusBadgeClass(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-600'
  if (status === 'PENDING') return 'bg-amber-500 hover:bg-amber-500'
  return ''
}

function statusBadgeVariant(status: string): 'default' | 'destructive' | 'outline' {
  if (status === 'ACTIVE' || status === 'PENDING') return 'default'
  return 'destructive'
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="col-span-2 text-sm font-medium text-slate-900">{value || '—'}</span>
    </div>
  )
}

export default function SuperAdminOrganizationsPage() {
  return (
    <Suspense>
      <SuperAdminOrganizationsContent />
    </Suspense>
  )
}

function SuperAdminOrganizationsContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [editOrg, setEditOrg] = useState<Organization | null>(null)
  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState('free')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [viewOrg, setViewOrg] = useState<OrgDetails | null>(null)
  const [viewMembers, setViewMembers] = useState<OrgMember[]>([])
  const [viewLoading, setViewLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  useEffect(() => {
    const status = searchParams.get('status')
    if (status) setStatusFilter(status)
  }, [searchParams])

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/superadmin/organizations?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setOrgs(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Could not load organizations', variant: 'destructive' })
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, toast])

  useEffect(() => {
    const t = setTimeout(fetchOrgs, 300)
    return () => clearTimeout(t)
  }, [fetchOrgs])

  const parseApiError = async (res: Response, fallback: string) => {
    try {
      const data = await res.json()
      if (typeof data?.error === 'string') return data.error
      if (Array.isArray(data?.error)) {
        return data.error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || fallback
      }
    } catch {
      // ignore
    }
    return fallback
  }

  const openView = async (org: Organization) => {
    setViewLoading(true)
    setViewOrg(null)
    setViewMembers([])
    try {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`)
      if (!res.ok) throw new Error('Failed to load details')
      const data = await res.json()
      const o = data.organization as Record<string, unknown>
      setViewOrg({
        id: String(o.id),
        name: String(o.name ?? ''),
        slug: String(o.slug ?? ''),
        status: String(o.status ?? ''),
        plan: String(o.plan ?? ''),
        createdAt: String(o.createdAt ?? o.created_at ?? ''),
        updatedAt: String(o.updatedAt ?? o.updated_at ?? ''),
        memberCount: Number(o.memberCount ?? 0),
        invoiceCount: Number(o.invoiceCount ?? 0),
        productCount: Number(o.productCount ?? 0),
        companyName: o.companyName != null ? String(o.companyName) : null,
        gstin: o.gstin != null ? String(o.gstin) : null,
        companyEmail: o.companyEmail != null ? String(o.companyEmail) : null,
        companyPhone: o.companyPhone != null ? String(o.companyPhone) : null,
        companyAddress: o.companyAddress != null ? String(o.companyAddress) : null,
        companyCity: o.companyCity != null ? String(o.companyCity) : null,
        companyState: o.companyState != null ? String(o.companyState) : null,
        companyPincode: o.companyPincode != null ? String(o.companyPincode) : null,
        ownerName: o.ownerName != null ? String(o.ownerName) : null,
        ownerEmail: o.ownerEmail != null ? String(o.ownerEmail) : null,
      })
      setViewMembers(Array.isArray(data.members) ? data.members : [])
    } catch {
      toast({ title: 'Error', description: 'Could not load organization details', variant: 'destructive' })
    } finally {
      setViewLoading(false)
    }
  }

  const openEdit = (org: Organization) => {
    setEditOrg(org)
    setEditName(org.name)
    setEditPlan((org.plan || 'free').toLowerCase())
    setEditStatus((org.status || 'ACTIVE').toUpperCase())
  }

  const saveEdit = async () => {
    if (!editOrg?.id) return
    if (editName.trim().length < 2) {
      toast({ title: 'Validation', description: 'Name must be at least 2 characters', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/superadmin/organizations/${editOrg.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          plan: editPlan,
          status: editStatus,
        }),
      })
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Update failed'))
      }
      toast({ title: 'Updated', description: `${editName.trim()} saved successfully` })
      setEditOrg(null)
      fetchOrgs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not update organization',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const approveOrg = async (org: Organization) => {
    if (!org.id) return
    setApprovingId(org.id)
    try {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (!res.ok) throw new Error(await parseApiError(res, 'Approval failed'))
      toast({ title: 'Approved', description: `${org.name} can now sign in.` })
      fetchOrgs()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not approve organisation',
        variant: 'destructive',
      })
    } finally {
      setApprovingId(null)
    }
  }

  const toggleSuspend = async (org: Organization) => {
    if (!org.id || org.status === 'PENDING') return
    const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const res = await fetch(`/api/superadmin/organizations/${org.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast({
        title: newStatus === 'SUSPENDED' ? 'Suspended' : 'Activated',
        description: org.name,
      })
      fetchOrgs()
    } else {
      toast({
        title: 'Error',
        description: await parseApiError(res, 'Could not update organization status'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
        <p className="text-sm text-slate-500">View and manage all tenant organizations</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">All Organizations ({orgs.length})</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search name or slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchOrgs} aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:py-2.5 [&>th]:px-3">
                <TableHead>Org ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[88px] text-right pr-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                    No organizations found
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id} className="[&>td]:py-2.5 [&>td]:px-3">
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-blue-700">
                        {org.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{org.companyName || org.name}</p>
                        {org.gstin && (
                          <p className="text-xs text-slate-500">{org.gstin}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {org.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.memberCount}</TableCell>
                    <TableCell>{org.invoiceCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(org.status)}
                        className={statusBadgeClass(org.status)}
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[108px] py-2 px-2">
                      <div className="flex items-center justify-end gap-0">
                        {org.status === 'PENDING' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={() => approveOrg(org)}
                            title="Approve organisation"
                            disabled={approvingId === org.id}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => openView(org)}
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => openEdit(org)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => toggleSuspend(org)}
                          title={org.status === 'ACTIVE' ? 'Suspend' : org.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                          disabled={org.status === 'PENDING'}
                        >
                          {org.status === 'ACTIVE' ? (
                            <Ban className="h-3.5 w-3.5 text-red-500" />
                          ) : org.status === 'SUSPENDED' ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Ban className="h-3.5 w-3.5 text-slate-300" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={viewLoading || !!viewOrg} onOpenChange={(open) => !open && !viewLoading && setViewOrg(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
          ) : viewOrg ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Basic Info</h3>
                <DetailRow label="Org ID" value={<span className="font-mono text-blue-700">{viewOrg.id}</span>} />
                <DetailRow label="Name" value={viewOrg.name} />
                <DetailRow label="Slug" value={viewOrg.slug} />
                <DetailRow label="Plan" value={<span className="capitalize">{viewOrg.plan}</span>} />
                <DetailRow
                  label="Status"
                  value={
                    <Badge className={statusBadgeClass(viewOrg.status)}>
                      {viewOrg.status}
                    </Badge>
                  }
                />
                <DetailRow label="Created" value={formatDate(viewOrg.createdAt)} />
                <DetailRow label="Updated" value={formatDate(viewOrg.updatedAt)} />
              </div>

              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Company</h3>
                <DetailRow label="Company Name" value={viewOrg.companyName} />
                <DetailRow label="Owner" value={viewOrg.ownerName} />
                <DetailRow label="GSTIN" value={viewOrg.gstin} />
                <DetailRow label="Email" value={viewOrg.ownerEmail || viewOrg.companyEmail} />
                <DetailRow label="Phone" value={viewOrg.companyPhone} />
                <DetailRow label="Address" value={viewOrg.companyAddress} />
                <DetailRow
                  label="City / State"
                  value={
                    [viewOrg.companyCity, viewOrg.companyState].filter(Boolean).join(', ') || null
                  }
                />
                <DetailRow label="Pincode" value={viewOrg.companyPincode} />
              </div>

              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Usage</h3>
                <DetailRow label="Members" value={viewOrg.memberCount} />
                <DetailRow label="Invoices" value={viewOrg.invoiceCount} />
                <DetailRow label="Products" value={viewOrg.productCount} />
              </div>

              {viewMembers.length > 0 && (
                <div className="rounded-lg border bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Members ({viewMembers.length})
                  </h3>
                  <ul className="space-y-2">
                    {viewMembers.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-slate-500">{m.email}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {m.role}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            {viewOrg?.status === 'PENDING' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={approvingId === viewOrg.id}
                onClick={async () => {
                  await approveOrg({
                    id: viewOrg.id,
                    name: viewOrg.name,
                  } as Organization)
                  setViewOrg({ ...viewOrg, status: 'ACTIVE' })
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewOrg(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            {editOrg && (
              <p className="text-sm text-muted-foreground font-mono">ID: {editOrg.id}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
