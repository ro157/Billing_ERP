'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Loader2, Printer } from 'lucide-react'
import { downloadPdfBlob, fetchDocumentPdf, printPdfBlobUrl } from '@/lib/document-pdf'

interface DocumentPdfViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfApiUrl: string | null
  title?: string
  filename?: string
}

export function DocumentPdfViewer({
  open,
  onOpenChange,
  pdfApiUrl,
  title = 'Document',
  filename = 'document.pdf',
}: DocumentPdfViewerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  const cleanup = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    blobRef.current = null
    setError(null)
  }

  useEffect(() => {
    if (!open || !pdfApiUrl) {
      cleanup()
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setPreviewUrl(null)
    blobRef.current = null

    fetchDocumentPdf(pdfApiUrl)
      .then((blob) => {
        if (cancelled) return
        blobRef.current = blob
        setPreviewUrl(URL.createObjectURL(blob))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load PDF'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [open, pdfApiUrl])

  const handleOpenChange = (next: boolean) => {
    if (!next) cleanup()
    onOpenChange(next)
  }

  const handlePrint = () => {
    if (!previewUrl) return
    printPdfBlobUrl(previewUrl)
  }

  const handleDownload = () => {
    if (!blobRef.current) return
    downloadPdfBlob(blobRef.current, filename)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-none w-screen h-[100dvh] left-0 top-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="pr-8">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 h-full text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading PDF...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full px-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : previewUrl ? (
            <iframe
              title={title}
              src={previewUrl}
              className="w-full h-full border-0 bg-white"
            />
          ) : null}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={loading || !!error || !previewUrl}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button
            onClick={handlePrint}
            disabled={loading || !!error || !previewUrl}
            className="w-full sm:w-auto"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
