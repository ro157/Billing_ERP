'use client'

import { SuperAdminShell } from '@/components/layout/superadmin-shell'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell>{children}</SuperAdminShell>
}
