'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

/** Keeps `dark` class on <html> in sync with persisted color mode. */
export function ThemeModeSync() {
  const colorMode = useAppStore((s) => s.colorMode)

  useEffect(() => {
    const root = document.documentElement
    if (colorMode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [colorMode])

  return null
}
