'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DocumentPdfViewer } from '@/components/shared/document-pdf-viewer'
import { Loader2 } from 'lucide-react'
import { parseJsonResponse } from '@/lib/fetch-json'

export default function ViewInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(async (res) => {
        const data = await parseJsonResponse<{ invoice_no?: string; error?: string }>(res)
        if (!res.ok) throw new Error(data.error || 'Not found')
        setInvoiceNo(data.invoice_no || 'Invoice')
        setPdfViewerOpen(true)
      })
      .catch(() => router.push('/billing'))
      .finally(() => setLoading(false))
  }, [id, router])

  const safeName = invoiceNo.replace(/[/\\?%*:|"<>]/g, '-')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading invoice...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/billing">
          <Button variant="outline" size="sm">Back to Invoices</Button>
        </Link>
        <Link href={`/billing/${id}/edit`}>
          <Button size="sm">Edit Invoice</Button>
        </Link>
      </div>

      <DocumentPdfViewer
        open={pdfViewerOpen}
        onOpenChange={(open) => {
          setPdfViewerOpen(open)
          if (!open) router.push('/billing')
        }}
        pdfApiUrl={`/api/invoices/${id}/pdf`}
        title={invoiceNo}
        filename={`${safeName}.pdf`}
        enableInvoiceCopies
      />
    </div>
  )
}
