'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  adminOnly?: boolean
  children?: NavItem[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: Package,
    permission: 'inventory:view',
  },
  {
    title: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'customers:view',
  },
  {
    title: 'Vendors',
    href: '/vendors',
    icon: Truck,
    permission: 'vendors:view',
  },
  {
    title: 'Quotations',
    href: '/quotations',
    icon: ClipboardList,
    permission: 'quotations:view',
  },
  {
    title: 'Billing / Invoices',
    href: '/billing',
    icon: FileText,
    permission: 'billing:view',
  },
  {
    title: 'Purchase Orders',
    href: '/purchase-orders',
    icon: ShoppingBag,
    permission: 'purchase-orders:view',
  },
  {
    title: 'Purchases',
    href: '/purchases',
    icon: ShoppingCart,
    permission: 'purchases:view',
  },
  {
    title: 'Delivery Challans',
    href: '/delivery-challans',
    icon: Send,
    permission: 'delivery-challans:view',
  },
  {
    title: 'Returnable Challans',
    href: '/returnable-challans',
    icon: RotateCcw,
    permission: 'returnable-challans:view',
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'reports:view',
  },
  {
    title: 'GST Reports',
    href: '/gst-reports',
    icon: Receipt,
    permission: 'gst-reports:view',
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: UserCog,
    adminOnly: true,
  },
  {
    title: 'Roles & Permissions',
    href: '/roles',
    icon: Shield,
    adminOnly: true,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    adminOnly: true,
  },
]

interface SidebarProps {
  open: boolean
}

export function Sidebar({ open }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const isAdmin = session?.user?.role === 'ADMIN'

  const isVisible = (item: NavItem): boolean => {
    if (item.adminOnly) return isAdmin
    if (!item.permission) return true
    const [module, action] = item.permission.split(':')
    return isAdmin || permissions.includes(`${module}:${action}`)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-slate-900 text-white transition-all duration-300',
        open ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4">
        <Building2 className="h-8 w-8 text-blue-400 shrink-0" />
        {open && (
          <span className="ml-3 text-lg font-bold text-white truncate">Viros GST</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navItems.filter(isVisible).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                  title={!open ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {open && <span className="truncate">{item.title}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
