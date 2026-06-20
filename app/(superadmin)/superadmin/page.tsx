'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, FileText, IndianRupee, Clock, CheckCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface PendingOrg {
  id: string
  name: string
  phone: string | null
  state: string | null
  ownerName: string | null
  ownerEmail: string | null
  createdAt: string
}

interface Stats {
  organizations: { total: number; active: number; suspended: number; pending: number }
  pendingOrganizations: PendingOrg[]
  users: number
  invoices: { total: number; revenue: number }
}

export default function SuperAdminOverviewPage() {
  const { toast } = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadStats = () => {
    setLoading(true)
    fetch('/api/superadmin/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStats()
  }, [])

  const approveOrg = async (org: PendingOrg) => {
    setApprovingId(org.id)
    try {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (!res.ok) throw new Error('Approval failed')
      toast({ title: 'Approved', description: `${org.name} can now sign in.` })
      loadStats()
    } catch {
      toast({ title: 'Error', description: 'Could not approve organisation', variant: 'destructive' })
    } finally {
      setApprovingId(null)
    }
  }

  const pending = stats?.pendingOrganizations ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-500">Platform-wide statistics across all organizations</p>
        </div>
        <Button asChild>
          <Link href="/superadmin/organizations">Manage Organizations</Link>
        </Button>
      </div>

      {!loading && (stats?.organizations.pending ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                <Clock className="h-4 w-4" />
                Pending Approvals ({stats?.organizations.pending ?? 0})
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/superadmin/organizations?status=PENDING">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((org) => (
              <div
                key={org.id}
                className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-blue-700">{org.id}</span>
                    <Badge className="bg-amber-500 hover:bg-amber-500">PENDING</Badge>
                  </div>
                  <p className="font-medium text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-500">
                    {org.ownerName}
                    {org.ownerEmail ? ` · ${org.ownerEmail}` : ''}
                    {org.phone ? ` · ${org.phone}` : ''}
                    {org.state ? ` · ${org.state}` : ''}
                    {org.createdAt ? ` · ${formatDate(org.createdAt)}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                  disabled={approvingId === org.id}
                  onClick={() => approveOrg(org)}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  {approvingId === org.id ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '—' : stats?.organizations.total ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.organizations.active ?? 0} active · {stats?.organizations.pending ?? 0} pending ·{' '}
              {stats?.organizations.suspended ?? 0} suspended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Platform Users</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '—' : stats?.users ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Across all organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '—' : stats?.invoices.total ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">All organizations combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Invoice Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? '—' : formatCurrency(stats?.invoices.revenue ?? 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Gross invoice value</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
