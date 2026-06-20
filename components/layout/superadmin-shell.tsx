'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Building2, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { title: 'Overview', href: '/superadmin', icon: LayoutDashboard },
  { title: 'Organizations', href: '/superadmin/organizations', icon: Building2 },
]

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-950 text-white">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <Shield className="h-7 w-7 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold leading-tight">Super Admin</p>
            <p className="text-xs text-slate-400">Platform Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/superadmin' && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-medium'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-2">
          {session?.user?.organizationId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
              onClick={() => router.push('/dashboard')}
            >
              Go to ERP Dashboard
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="ml-64 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Platform Administration</h1>
            <p className="text-xs text-slate-500">{session?.user?.email}</p>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
