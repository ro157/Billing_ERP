'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'

export function ThemeModeToggle() {
  const colorMode = useAppStore((s) => s.colorMode)
  const toggleColorMode = useAppStore((s) => s.toggleColorMode)
  const isDark = colorMode === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleColorMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <Moon className="h-5 w-5 text-amber-400" />
      ) : (
        <Sun className="h-5 w-5 text-amber-500" />
      )}
    </Button>
  )
}
