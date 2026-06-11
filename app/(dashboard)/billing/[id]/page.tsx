'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Edit, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoiceItem {
  description?: string | null
  quantity: number
  rate: number
  discount?: number
  gst_rate: number
  amount: number
}

interface InvoiceDetail {
  id: string
  invoice_no: string
  date: string
  due_date?: string
  customer_name: string
  customer_gstin?: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  notes?: string
  items: InvoiceItem[]
}

export default function ViewInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(setInvoice)
      .catch(() => {
        toast({ title: 'Invoice not found', variant: 'destructive' })
        router.push('/billing')
      })
      .finally(() => setLoading(false))
  }, [id, router, toast])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading invoice...</p>
      </div>
    )
  }

  if (!invoice) return null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{invoice.invoice_no}</h1>
            <p className="text-sm text-muted-foreground">{invoice.customer_name}</p>
          </div>
        </div>
        <Link href={`/billing/${id}/edit`}>
          <Button className="w-full sm:w-auto">
            <Edit className="w-4 h-4 mr-2" />
            Edit Invoice
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(invoice.date)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-primary">{formatCurrency(invoice.total_amount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.description || '-'}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                  <TableCell className="text-right">{item.gst_rate}%</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span>{formatCurrency(invoice.paid_amount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance</span>
            <span>{formatCurrency(invoice.balance_amount)}</span>
          </div>
          {invoice.notes && (
            <p className="text-sm text-muted-foreground pt-2 border-t">{invoice.notes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
