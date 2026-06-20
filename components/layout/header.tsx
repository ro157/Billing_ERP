'use client'

import { useSession, signOut } from 'next-auth/react'
import { Menu, Bell, LogOut, User, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { OrgSwitcher } from '@/components/layout/org-switcher'
import { ThemeModeToggle } from '@/components/layout/theme-mode-toggle'

export function Header() {
  const { toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileSidebarOpen(!mobileSidebarOpen)
    } else {
      toggleSidebar()
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background px-3 md:px-4 shadow-sm">
      <Button variant="ghost" size="icon" onClick={handleMenuClick} aria-label="Toggle menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 min-w-0">
        <OrgSwitcher />
        {session?.user?.isSuperAdmin && (
          <Link
            href="/superadmin"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            <Shield className="h-3.5 w-3.5" />
            Super Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <ThemeModeToggle />
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-full p-1 hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {getInitials(session?.user?.name || 'U')}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.orgRole || session?.user?.role}</p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover shadow-lg z-50">
              <div className="p-2 border-b border-border">
                <p className="text-sm font-medium text-popover-foreground">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
              <div className="p-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setDropdownOpen(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
