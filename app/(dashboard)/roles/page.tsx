'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { STAFF_ASSIGNABLE_MODULES, formatModuleLabel } from '@/lib/permissions'
import { getInitials } from '@/lib/utils'

interface StaffPermission {
  id: string
  name: string
  email: string
  status: string
  modules: string[]
  moduleCount: number
}

type DialogMode = 'create' | 'edit' | 'view' | null

export default function RolesPage() {
  const { toast } = useToast()
  const [staffList, setStaffList] = useState<StaffPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffPermission | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/staff-permissions')
    const data = await res.json()
    setStaffList(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  const resetModules = (modules: string[] = []) => {
    const next: Record<string, boolean> = {}
    for (const mod of STAFF_ASSIGNABLE_MODULES) {
      next[mod] = modules.includes(mod)
    }
    setEnabledModules(next)
  }

  const openNew = () => {
    setSelectedStaff(null)
    setSelectedUserId('')
    resetModules()
    setDialogMode('create')
  }

  const openView = (staff: StaffPermission) => {
    setSelectedStaff(staff)
    setSelectedUserId(staff.id)
    resetModules(staff.modules)
    setDialogMode('view')
  }

  const openEdit = (staff: StaffPermission) => {
    setSelectedStaff(staff)
    setSelectedUserId(staff.id)
    resetModules(staff.modules)
    setDialogMode('edit')
  }

  const toggleModule = (module: string) => {
    if (dialogMode === 'view') return
    setEnabledModules((prev) => ({ ...prev, [module]: !prev[module] }))
  }

  const getSelectedModules = () =>
    STAFF_ASSIGNABLE_MODULES.filter((mod) => enabledModules[mod])

  const onSave = async () => {
    const userId = dialogMode === 'create' ? selectedUserId : selectedStaff?.id
    if (!userId) {
      toast({ title: 'Please select an employee', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const modules = getSelectedModules()
      const url =
        dialogMode === 'create'
          ? '/api/staff-permissions'
          : `/api/staff-permissions/${userId}`
      const method = dialogMode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, modules }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to save')
      }
      toast({
        title: dialogMode === 'create' ? 'Permissions assigned' : 'Permissions updated',
        description: dialogMode === 'create' ? undefined : 'Role permissions saved successfully.',
      })
      setDialogMode(null)
      fetchPermissions()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (staff: StaffPermission) => {
    if (!confirm(`Remove all permissions for ${staff.name}?`)) return
    const res = await fetch(`/api/staff-permissions/${staff.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Permissions removed' })
      fetchPermissions()
    } else {
      const e = await res.json()
      toast({ title: e.error || 'Error', variant: 'destructive' })
    }
  }

  const staffWithoutPermissions = staffList.filter((s) => s.moduleCount === 0)
  const staffWithPermissions = staffList.filter((s) => s.moduleCount > 0)

  const dialogTitle =
    dialogMode === 'create'
      ? 'New Permission'
      : dialogMode === 'edit'
        ? 'Edit Permission'
        : 'View Permission'

  const isReadOnly = dialogMode === 'view'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">Assign module access for each employee</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          New Permission
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : staffWithPermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No permissions assigned yet. Click &quot;New Permission&quot; to assign access.
                </TableCell>
              </TableRow>
            ) : (
              staffWithPermissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                        {getInitials(s.name)}
                      </div>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.moduleCount} module{s.moduleCount !== 1 ? 's' : ''}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="View" onClick={() => openView(s)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(s)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {dialogMode === 'create' ? (
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select value={selectedUserId || undefined} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffWithoutPermissions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {staffList.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add staff members first from Staff Management.</p>
                )}
                {staffList.length > 0 && staffWithoutPermissions.length === 0 && (
                  <p className="text-sm text-muted-foreground">All staff already have permissions. Use Edit to modify.</p>
                )}
              </div>
            ) : selectedStaff ? (
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="font-medium">{selectedStaff.name}</p>
                <p className="text-sm text-muted-foreground">{selectedStaff.email}</p>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label>Module Access</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Enable a module to grant full access (view, create, edit, delete, print, export).
              </p>
              <div className="border rounded-lg divide-y">
                {STAFF_ASSIGNABLE_MODULES.map((module) => (
                  <div
                    key={module}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm font-medium">{formatModuleLabel(module)}</span>
                    <Switch
                      checked={!!enabledModules[module]}
                      onCheckedChange={() => toggleModule(module)}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : dialogMode === 'create' ? 'Assign' : 'Update'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {staffWithoutPermissions.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {staffWithoutPermissions.length} staff member(s) without permissions yet.
        </p>
      )}
    </div>
  )
}
