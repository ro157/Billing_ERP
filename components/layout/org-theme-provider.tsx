'use client'

import { useEffect } from 'react'
import { applyOrgTheme } from '@/lib/theme'

export function OrgThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const loadTheme = () => {
      fetch('/api/auth/branding')
        .then((r) => r.json())
        .then((data) => applyOrgTheme(data?.sidebarColor))
        .catch(() => {})
    }

    loadTheme()
    window.addEventListener('branding-updated', loadTheme)
    return () => window.removeEventListener('branding-updated', loadTheme)
  }, [])

  return <>{children}</>
}
