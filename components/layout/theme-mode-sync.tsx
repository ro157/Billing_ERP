'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { isLightOnlyRoute } from '@/lib/theme-mode'

/** Keeps `dark` class on <html> in sync with persisted color mode (dashboard only). */
export function ThemeModeSync() {
  const colorMode = useAppStore((s) => s.colorMode)
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement

    if (isLightOnlyRoute(pathname)) {
      root.classList.remove('dark')
      return
    }

    if (colorMode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [colorMode, pathname])

  return null
}
