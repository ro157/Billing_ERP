'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeModeSync } from '@/components/layout/theme-mode-sync'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <ThemeModeSync />
      {children}
    </SessionProvider>
  )
}
