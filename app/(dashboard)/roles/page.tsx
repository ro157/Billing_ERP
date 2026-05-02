'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/utils'

interface Role {
  id: string; name: string; description?: string; _count?: { rolePermissions: number }
  rolePermissions?: { module: string; action: string }[]
}

export default function RolesPage() {
  const { toast } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})

  const form = useForm({ defaultValues: { name: '', description: '' } })

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/roles')
    const data = await res.json()
    setRoles(data.roles || data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const togglePermission = (module: string, action: string) => {
    setPermissions(prev => {
      const current = prev[module] || []
      return {
        ...prev,
        [module]: current.includes(action)
          ? current.filter(a => a !== action)
          : [...current, action]
      }
    })
  }

  const hasPermission = (module: string, action: string) => (permissions[module] || []).includes(action)

  const toggleAll = (module: string) => {
    const current = permissions[module] || []
    setPermissions(prev => ({
      ...prev,
      [module]: current.length === PERMISSION_ACTIONS.length ? [] : [...PERMISSION_ACTIONS]
    }))
  }

  const openNew = () => {
    setEditing(null)
    form.reset({ name: '', description: '' })
    setPermissions({})
    setDialogOpen(true)
  }

  const openEdit = async (role: Role) => {
    setEditing(role)
    form.reset({ name: role.name, description: role.description || '' })
    const res = await fetch(`/api/roles/${role.id}`)
    const data = await res.json()
    const perms: Record<string, string[]> = {}
    for (const p of data.permissions || []) {
      const mod = p.permission?.module
      const act = p.permission?.action
      if (!mod || !act) continue
      if (!perms[mod]) perms[mod] = []
      perms[mod].push(act)
    }
    setPermissions(perms)
    setDialogOpen(true)
  }

  const onSubmit = async (data: any) => {
    setSaving(true)
    try {
      const permsArray: { module: string; action: string }[] = []
      Object.entries(permissions).forEach(([module, actions]) =>
        (actions as string[]).forEach(action => permsArray.push({ module, action }))
      )
      const url = editing ? `/api/roles/${editing.id}` : '/api/roles'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, permissions: permsArray }) })
      if (!res.ok) throw new Error('Failed')
      toast({ title: editing ? 'Role updated' : 'Role created' })
      setDialogOpen(false)
      fetchRoles()
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role?')) return
    const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Deleted' }); fetchRoles() }
    else { const e = await res.json(); toast({ title: e.error || 'Error', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Roles & Permissions</h1><p className="text-muted-foreground">Manage access control</p></div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />New Role</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead><TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : roles.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No roles found</TableCell></TableRow>
            ) : roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.description || '-'}</TableCell>
                <TableCell>{r._count?.rolePermissions || 0} permissions</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Role' : 'New Role'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Role Name *</Label><Input {...form.register('name')} /></div>
                <div className="space-y-2"><Label>Description</Label><Input {...form.register('description')} /></div>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Permission Matrix</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-36">Module</TableHead>
                        {PERMISSION_ACTIONS.map(a => <TableHead key={a} className="text-center capitalize">{a}</TableHead>)}
                        <TableHead className="text-center">All</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_MODULES.map(module => (
                        <TableRow key={module}>
                          <TableCell className="font-medium capitalize text-sm">{module.replace('_', ' ')}</TableCell>
                          {PERMISSION_ACTIONS.map(action => (
                            <TableCell key={action} className="text-center">
                              <Switch
                                checked={hasPermission(module, action)}
                                onCheckedChange={() => togglePermission(module, action)}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Switch
                              checked={(permissions[module] || []).length === PERMISSION_ACTIONS.length}
                              onCheckedChange={() => toggleAll(module)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
