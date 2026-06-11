'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Branding {
  companyName: string
  logo: string | null
}

interface AuthShellProps {
  children: React.ReactNode
  showLogo?: boolean
}

export function AuthShell({ children, showLogo = false }: AuthShellProps) {
  const [branding, setBranding] = useState<Branding>({
    companyName: 'Viros GST Billing',
    logo: null,
  })

  useEffect(() => {
    fetch('/api/auth/branding')
      .then((r) => r.json())
      .then((data: Branding) => {
        if (data?.companyName) {
          setBranding({
            companyName: data.companyName,
            logo: data.logo ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-2 border-blue-600 shadow-lg overflow-hidden">
        {showLogo && (
          <div className="flex flex-col items-center pt-8 px-6 pb-2">
            {branding.logo ? (
              <img
                src={branding.logo}
                alt={branding.companyName}
                className="h-16 max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
                <Building2 className="h-9 w-9 text-white" />
              </div>
            )}
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome</h1>
          </div>
        )}

        <div className={showLogo ? 'px-6 pb-2' : 'p-6'}>{children}</div>

        <div className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {branding.companyName}. All rights reserved.
        </div>
      </Card>
    </div>
  )
}
