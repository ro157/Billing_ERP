'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Edit, Trash2, User } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface StaffMember {
  id: string; name: string; email: string; status: string; role: string
  staffRoles?: { role: { id: string; name: string } }[]
}

function formatApiError(error: unknown): string {
  if (typeof error === 'string') return error
  if (Array.isArray(error)) {
    return error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || 'Validation failed'
  }
  return 'Something went wrong'
}

export default function StaffPage() {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useForm({ defaultValues: { name: '', email: '', password: '', role: 'STAFF', status: 'ACTIVE' } })

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/staff?${params}`)
    const data = await res.json()
    setStaff(data.staff || data)
    setTotal(data.total || data.length)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const openNew = () => {
    setEditing(null)
    form.reset({ name: '', email: '', password: '', role: 'STAFF', status: 'ACTIVE' })
    setDialogOpen(true)
  }

  const openEdit = (s: StaffMember) => {
    setEditing(s)
    form.reset({
      name: s.name,
      email: s.email,
      password: '',
      role: s.role || 'STAFF',
      status: s.status || 'ACTIVE',
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: any) => {
    setSaving(true)
    try {
      const url = editing ? `/api/staff/${editing.id}` : '/api/staff'
      const method = editing ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
      }
      if (data.password?.trim()) payload.password = data.password
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(formatApiError(e.error) || 'Failed')
      }
      toast({ title: editing ? 'Staff updated' : 'Staff created' })
      setDialogOpen(false)
      fetchStaff()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this staff member?')) return
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Staff deleted' }); fetchStaff() }
    else { const e = await res.json(); toast({ title: e.error || 'Error', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Staff Management</h1><p className="text-muted-foreground">{total} member(s)</p></div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Staff</Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search staff..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </CardContent></Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : staff.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No staff found</TableCell></TableRow>
            ) : staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                      {getInitials(s.name)}
                    </div>
                    {s.name}
                  </div>
                </TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'destructive'}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Staff' : 'Add Staff'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Name *</Label><Input {...form.register('name')} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" {...form.register('email')} /></div>
              <div className="space-y-2">
                <Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
                <Input type="password" {...form.register('password')} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.watch('role') || 'STAFF'}
                  onValueChange={(v) => form.setValue('role', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch('status') || 'ACTIVE'}
                  onValueChange={(v) => form.setValue('status', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
