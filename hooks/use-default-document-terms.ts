'use client'

import { useEffect } from 'react'
import type { DefaultDocumentTermsModule } from '@/lib/document-terms'
import { fetchDefaultDocumentTerms } from '@/lib/document-terms'

/** Pre-fill terms from Settings when creating a new document. */
export function useDefaultDocumentTerms(
  module: DefaultDocumentTermsModule,
  enabled: boolean,
  onApply: (terms: string) => void
) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchDefaultDocumentTerms(module).then((terms) => {
      if (!cancelled && terms) onApply(terms)
    })
    return () => {
      cancelled = true
    }
  }, [module, enabled, onApply])
}
