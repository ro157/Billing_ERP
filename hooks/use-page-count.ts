'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

/** Show a document/item count under the module title in the app header. */
export function usePageCount(label: string | null) {
  const setPageCountLabel = useAppStore((s) => s.setPageCountLabel)
  const clearPageCountLabel = useAppStore((s) => s.clearPageCountLabel)

  useEffect(() => {
    if (!label) {
      clearPageCountLabel()
      return
    }
    setPageCountLabel(label)
    return () => clearPageCountLabel()
  }, [label, setPageCountLabel, clearPageCountLabel])
}
