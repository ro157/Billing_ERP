import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate } from '@/lib/utils'

interface BusinessSettings {
  businessName: string
  address?: string | null
  city?: string | null
  state?: string | null
  gstin?: string | null
  phone?: string | null
  email?: string | null
  bankName?: string | null
  bankAccount?: string | null
  ifscCode?: string | null
  termsAndConditions?: string | null
}

export function generateInvoicePDF(invoice: any, settings?: BusinessSettings) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(settings?.businessName || 'Company Name', 14, y)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  y += 7
  if (settings?.address) { doc.text(settings.address, 14, y); y += 5 }
  if (settings?.city || settings?.state) { doc.text([settings?.city, settings?.state].filter(Boolean).join(', '), 14, y); y += 5 }
  if (settings?.phone) { doc.text(`Phone: ${settings.phone}`, 14, y); y += 5 }
  if (settings?.gstin) { doc.text(`GSTIN: ${settings.gstin}`, 14, y); y += 5 }

  // Invoice title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', pageWidth / 2, 15, { align: 'center' })

  // Invoice details (top right)
  const rightX = pageWidth - 14
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Invoice No: ${invoice.invoiceNo}`, rightX, 30, { align: 'right' })
  doc.text(`Date: ${formatDate(invoice.date)}`, rightX, 36, { align: 'right' })
  if (invoice.dueDate) doc.text(`Due: ${formatDate(invoice.dueDate)}`, rightX, 42, { align: 'right' })

  // Divider
  y = Math.max(y, 55)
  doc.setDrawColor(200)
  doc.line(14, y, pageWidth - 14, y)
  y += 6

  // Bill To
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.customer?.name || '', 14, y); y += 5
  if (invoice.customer?.address) { doc.text(invoice.customer.address, 14, y); y += 5 }
  if (invoice.customer?.gstin) { doc.text(`GSTIN: ${invoice.customer.gstin}`, 14, y); y += 5 }

  y += 4

  // Items table
  const rows = (invoice.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.description || item.product?.name || '',
    item.hsnCode || '',
    item.quantity,
    formatCurrency(item.rate),
    `${item.discount || 0}%`,
    `${item.gstRate || 0}%`,
    formatCurrency(item.amount),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN', 'Qty', 'Rate', 'Disc', 'GST%', 'Amount']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 16 }, 4: { halign: 'right' }, 7: { halign: 'right' } },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 6

  // Totals
  const totalsData = [
    ['Taxable Amount', formatCurrency(invoice.taxableAmount)],
  ]
  if (invoice.cgstAmount > 0) totalsData.push(['CGST', formatCurrency(invoice.cgstAmount)])
  if (invoice.sgstAmount > 0) totalsData.push(['SGST', formatCurrency(invoice.sgstAmount)])
  if (invoice.igstAmount > 0) totalsData.push(['IGST', formatCurrency(invoice.igstAmount)])
  if (invoice.roundOff) totalsData.push(['Round Off', formatCurrency(invoice.roundOff)])
  totalsData.push(['Total Amount', formatCurrency(invoice.totalAmount)])
  totalsData.push(['Paid Amount', formatCurrency(invoice.paidAmount)])
  totalsData.push(['Balance Due', formatCurrency(invoice.balanceAmount)])

  autoTable(doc, {
    startY: finalY,
    body: totalsData,
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { halign: 'right' } },
    tableWidth: 80,
    margin: { left: pageWidth - 94 },
    didParseCell: (data) => {
      if (data.row.index === totalsData.length - 3) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 9
      }
    }
  })

  // Bank details
  if (settings?.bankName) {
    const bankY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Bank Details:', 14, bankY)
    doc.setFont('helvetica', 'normal')
    doc.text(`Bank: ${settings.bankName}`, 14, bankY + 5)
    if (settings.bankAccount) doc.text(`A/c No: ${settings.bankAccount}`, 14, bankY + 10)
    if (settings.ifscCode) doc.text(`IFSC: ${settings.ifscCode}`, 14, bankY + 15)
  }

  // Terms
  if (settings?.termsAndConditions) {
    const termsY = doc.internal.pageSize.getHeight() - 25
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions:', 14, termsY)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(settings.termsAndConditions, pageWidth - 28)
    doc.text(lines.slice(0, 3), 14, termsY + 4)
  }

  doc.save(`${invoice.invoiceNo}.pdf`)
}

export function generateReportPDF(data: any[], title: string, columns: { header: string; key: string }[]) {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 15)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 21)

  const head = [columns.map(c => c.header)]
  const body = data.map(row => columns.map(c => {
    const val = row[c.key]
    if (val === null || val === undefined) return '-'
    return String(val)
  }))

  autoTable(doc, {
    startY: 26,
    head,
    body,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
  })

  doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
