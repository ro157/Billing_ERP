'use client'

import { useEffect } from 'react'

/** Ensures auth pages never inherit dashboard dark mode. */
export function AuthLightMode() {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  return null
}
