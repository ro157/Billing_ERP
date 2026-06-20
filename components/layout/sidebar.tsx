'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Truck,
  ClipboardList,
  ShoppingBag,
  Send,
  RotateCcw,
  BarChart3,
  Receipt,
  UserCog,
  Shield,
  Settings,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { DEFAULT_SIDEBAR_COLOR, normalizeSidebarColor } from '@/lib/theme'

interface Branding {
  companyName: string
  logo: string | null
  sidebarColor: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { title: 'Inventory', href: '/inventory', icon: Package, permission: 'inventory:view' },
  { title: 'Customers', href: '/customers', icon: Users, permission: 'customers:view' },
  { title: 'Vendors', href: '/vendors', icon: Truck, permission: 'vendors:view' },
  { title: 'Quotations', href: '/quotations', icon: ClipboardList, permission: 'quotations:view' },
  { title: 'Billing / Invoices', href: '/billing', icon: FileText, permission: 'billing:view' },
  { title: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingBag, permission: 'purchase-orders:view' },
  { title: 'Purchases', href: '/purchases', icon: ShoppingCart, permission: 'purchases:view' },
  { title: 'Delivery Challans', href: '/delivery-challans', icon: Send, permission: 'delivery-challans:view' },
  { title: 'Returnable Challans', href: '/returnable-challans', icon: RotateCcw, permission: 'returnable-challans:view' },
  { title: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports:view' },
  { title: 'GST Reports', href: '/gst-reports', icon: Receipt, permission: 'gst-reports:view' },
  { title: 'Staff', href: '/staff', icon: UserCog, adminOnly: true },
  { title: 'Staff Permissions', href: '/roles', icon: Shield, adminOnly: true },
  { title: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

interface SidebarProps {
  open: boolean
}

export function Sidebar({ open }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const isAdmin = session?.user?.role === 'ADMIN'
  const { mobileSidebarOpen, setMobileSidebarOpen } = useAppStore()
  const [branding, setBranding] = useState<Branding>({
    companyName: 'Viros GST',
    logo: null,
    sidebarColor: DEFAULT_SIDEBAR_COLOR,
  })

  const loadBranding = () => {
    fetch('/api/auth/branding')
      .then((r) => r.json())
      .then((data: Branding) => {
        setBranding({
          companyName: data?.companyName || 'Viros GST',
          logo: data?.logo ?? null,
          sidebarColor: normalizeSidebarColor(data?.sidebarColor),
        })
      })
      .catch(() => {})
  }

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])

  useEffect(() => {
    loadBranding()
    window.addEventListener('branding-updated', loadBranding)
    return () => window.removeEventListener('branding-updated', loadBranding)
  }, [])

  const isOrgAdmin = session?.user?.orgRole === 'OWNER' || session?.user?.orgRole === 'ADMIN'

  const isVisible = (item: NavItem): boolean => {
    if (item.adminOnly) return isOrgAdmin
    if (!item.permission) return true
    const [module, action] = item.permission.split(':')
    return isAdmin || permissions.includes(`${module}:${action}`)
  }

  const visibleItems = useMemo(() => navItems.filter(isVisible), [isAdmin, permissions])
  const showLabels = open || mobileSidebarOpen

  useEffect(() => {
    visibleItems.forEach((item) => router.prefetch(item.href))
  }, [visibleItems, router])

  return (
    <aside
      style={{ backgroundColor: branding.sidebarColor }}
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col text-white transition-transform duration-300 ease-in-out',
        'w-64 -translate-x-full md:translate-x-0',
        mobileSidebarOpen && 'translate-x-0',
        open ? 'md:w-64' : 'md:w-16'
      )}
    >
      <div className="flex h-14 md:h-16 items-center border-b border-white/10 px-4 min-w-0">
        {branding.logo ? (
          <img
            src={branding.logo}
            alt={branding.companyName}
            className="h-7 w-7 md:h-8 md:w-8 shrink-0 object-contain"
          />
        ) : (
          <Building2 className="h-7 w-7 md:h-8 md:w-8 text-blue-400 shrink-0" />
        )}
        {showLabels && (
          <span className="ml-3 text-base md:text-lg font-bold text-white truncate">
            {branding.companyName}
          </span>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  )}
                  title={!showLabels ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {showLabels && <span className="truncate">{item.title}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
