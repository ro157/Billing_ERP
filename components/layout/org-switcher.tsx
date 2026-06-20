'use client'

import { useSession } from 'next-auth/react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function OrgSwitcher() {
  const { data: session, update } = useSession()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const orgs = session?.user?.organizations || []
  const currentOrgId = session?.user?.organizationId

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session?.user?.organizationName) return null

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === currentOrgId || switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })
      if (!res.ok) return
      await update({ organizationId })
      window.location.reload()
    } finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => orgs.length > 1 && setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm hover:bg-accent max-w-[200px] md:max-w-[260px]',
          orgs.length <= 1 && 'cursor-default'
        )}
        disabled={switching}
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">{session.user.organizationName}</span>
        {orgs.length > 1 && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && orgs.length > 1 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Switch Organization
            </p>
          </div>
          <ul className="p-1 max-h-60 overflow-y-auto">
            {orgs.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(org.id)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent text-left text-popover-foreground"
                >
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === currentOrgId && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
