import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { amountInWords } from '@/lib/amount-in-words'
import { drawDocumentHeader } from '@/lib/document-header-pdf'
import { computeQuotationItemTotals } from '@/lib/quotation-totals'
import { INDIAN_STATES, roundToTwo } from '@/lib/utils'

const QUOTATION_TITLE_BLUE: [number, number, number] = [41, 98, 160]
const TEXT: [number, number, number] = [30, 30, 30]
const BORDER: [number, number, number] = [0, 0, 0]
const MARGIN = 8
const DETAIL_FONT_SIZE = 7
const DETAIL_LINE_HEIGHT = 3.4
const DETAIL_CELL_PADDING = 2

export interface QuotationPdfSettings {
  companyName: string
  gstin?: string | null
  pan?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logo?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  bankBranch?: string | null
  bankMicr?: string | null
  upiId?: string | null
  termsCondition?: string | null
}

export interface QuotationPdfCustomer {
  name: string
  contact_person?: string | null
  phone?: string | null
  mobile?: string | null
  gstin?: string | null
  pan?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_state?: string | null
  shipping_address?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
}

export interface QuotationPdfItem {
  description?: string | null
  product_name?: string | null
  hsn_code?: string | null
  sac_code?: string | null
  unit_short?: string | null
  quantity: number
  rate: number
  discount?: number
  gst_rate: number
  amount: number
}

export interface QuotationPdfData {
  quotation_no: string
  date: string
  valid_until?: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  round_off?: number
  total_amount: number
  terms?: string | null
  notes?: string | null
  customer: QuotationPdfCustomer
  consignee?: QuotationPdfCustomer
  items: QuotationPdfItem[]
}

type LabeledLine = { label: string; value: string; valueBold?: boolean }

function formatPdfDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`
}

function formatMoney(n: number): string {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHsnSac(hsn?: string | null, sac?: string | null): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || '-'
}

function stateWithCode(stateName?: string | null): string {
  if (!stateName) return '-'
  const found = INDIAN_STATES.find((s) => s.name.toLowerCase() === stateName.toLowerCase())
  return found ? `${stateName} ( ${found.code} )` : stateName
}

function getPartyFields(party: QuotationPdfCustomer, isShipping: boolean): LabeledLine[] {
  const addr = isShipping
    ? party.shipping_address || party.billing_address
    : party.billing_address
  const state = isShipping ? party.shipping_state || party.billing_state : party.billing_state
  const lines: LabeledLine[] = [
    { label: 'Name:', value: party.name || '-' },
    { label: isShipping ? 'S.Person:' : 'B.Person:', value: party.contact_person || '-' },
    { label: 'Address:', value: addr ? addr.replace(/\n/g, ', ') : '-' },
    { label: 'Phone:', value: party.mobile || party.phone || '-' },
    { label: 'GSTIN:', value: party.gstin?.trim() || '-' },
    { label: 'State:', value: stateWithCode(state) },
  ]
  if (!isShipping) {
    lines.splice(5, 0, { label: 'PAN:', value: party.pan?.trim() || '-' })
    lines.push({ label: 'Place of Supply:', value: stateWithCode(state) })
  }
  return lines
}

function getQuotationMetaFields(quotation: QuotationPdfData): LabeledLine[] {
  const lines: LabeledLine[] = [
    { label: 'Quotation No.', value: quotation.quotation_no, valueBold: true },
    { label: 'Quotation Date', value: formatPdfDate(quotation.date), valueBold: true },
  ]
  if (quotation.valid_until) {
    lines.push({
      label: 'Valid Till',
      value: formatPdfDate(quotation.valid_until),
      valueBold: true,
    })
  }
  return lines
}

function estimateLabeledBlockHeight(doc: jsPDF, lines: LabeledLine[], maxWidth: number): number {
  let height = DETAIL_CELL_PADDING * 2
  doc.setFontSize(DETAIL_FONT_SIZE)
  for (const line of lines) {
    doc.setFont('helvetica', 'bold')
    const labelWidth = doc.getTextWidth(line.label) + 1
    doc.setFont('helvetica', line.valueBold ? 'bold' : 'normal')
    const wrapped = doc.splitTextToSize(line.value, Math.max(8, maxWidth - labelWidth))
    height += wrapped.length * DETAIL_LINE_HEIGHT
  }
  return height
}

function drawLabeledBlock(doc: jsPDF, x: number, y: number, maxWidth: number, lines: LabeledLine[]): void {
  doc.setFontSize(DETAIL_FONT_SIZE)
  doc.setTextColor(...TEXT)
  let cy = y + DETAIL_CELL_PADDING
  for (const line of lines) {
    doc.setFont('helvetica', 'bold')
    const labelWidth = doc.getTextWidth(line.label) + 1
    doc.text(line.label, x, cy)
    doc.setFont('helvetica', line.valueBold ? 'bold' : 'normal')
    const wrapped = doc.splitTextToSize(line.value, Math.max(8, maxWidth - labelWidth))
    doc.text(wrapped, x + labelWidth, cy)
    cy += wrapped.length * DETAIL_LINE_HEIGHT
  }
}

function inferGstType(companyState?: string | null, customerState?: string | null): 'CGST_SGST' | 'IGST' {
  if (!companyState || !customerState) return 'CGST_SGST'
  return companyState.trim().toLowerCase() === customerState.trim().toLowerCase() ? 'CGST_SGST' : 'IGST'
}

export function generateQuotationPdfBuffer(
  quotation: QuotationPdfData,
  settings: QuotationPdfSettings
): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2

  // Letterhead outside the document body box
  const boxTop = drawDocumentHeader(doc, settings, MARGIN, pageW)

  const bodyLeft = MARGIN
  const bodyRight = MARGIN + contentW
  let y = boxTop

  // ── Title row: single merged row (no column splits) ──
  const titleRowH = 9
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(bodyLeft, y, bodyRight, y)

  const titleMidY = y + titleRowH / 2 + 1
  doc.setFontSize(8)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  const gstinLabel = 'GSTIN :'
  doc.text(gstinLabel, bodyLeft + 2, titleMidY)
  doc.setFont('helvetica', 'normal')
  doc.text(settings.gstin || '-', bodyLeft + 2 + doc.getTextWidth(gstinLabel) + 1, titleMidY)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...QUOTATION_TITLE_BLUE)
  doc.text('Quotation', pageW / 2, titleMidY, { align: 'center' })

  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text('ORIGINAL FOR RECIPIENT', bodyRight - 2, titleMidY, { align: 'right' })

  y += titleRowH
  doc.line(bodyLeft, y, bodyRight, y)

  // ── Buyer / Consignee / Quotation meta (3 columns only below title row) ──
  const colW = contentW / 3
  const cellPad = DETAIL_CELL_PADDING
  const textW = colW - cellPad * 2
  const consigneeParty = quotation.consignee || quotation.customer

  const buyerFields = getPartyFields(quotation.customer, false)
  const consigneeFields = getPartyFields(consigneeParty, true)
  const metaFields = getQuotationMetaFields(quotation)
  const detailsRowHeight = Math.max(
    estimateLabeledBlockHeight(doc, buyerFields, textW),
    estimateLabeledBlockHeight(doc, consigneeFields, textW),
    estimateLabeledBlockHeight(doc, metaFields, textW)
  )

  const partyGridTop = y
  autoTable(doc, {
    startY: y,
    margin: { left: bodyLeft, right: MARGIN },
    tableWidth: contentW,
    theme: 'grid',
    styles: {
      fontSize: DETAIL_FONT_SIZE,
      cellPadding: cellPad,
      lineColor: BORDER,
      lineWidth: 0.25,
      textColor: TEXT,
      valign: 'top',
    },
    body: [
      [
        {
          content: 'Details of Buyer | Billed to :',
          styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 7 },
        },
        {
          content: 'Details of Consignee | Shipped to :',
          styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 7 },
        },
        {
          content: '',
          styles: { minCellHeight: 7 },
        },
      ],
      [
        { content: '', styles: { minCellHeight: detailsRowHeight } },
        { content: '', styles: { minCellHeight: detailsRowHeight } },
        { content: '', styles: { minCellHeight: detailsRowHeight } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: colW },
      1: { cellWidth: colW },
      2: { cellWidth: colW },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.row.index !== 1) return
      const fields =
        data.column.index === 0
          ? buyerFields
          : data.column.index === 1
            ? consigneeFields
            : metaFields
      drawLabeledBlock(doc, data.cell.x + cellPad, data.cell.y, data.cell.width - cellPad * 2, fields)
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30
  doc.line(bodyLeft, y, bodyRight, y)

  doc.setDrawColor(...BORDER)
  doc.line(bodyLeft, boxTop, bodyLeft, y)
  doc.line(bodyRight, boxTop, bodyRight, y)
  y += 2

  // ── Items table ──
  const gstType = inferGstType(settings.state, quotation.customer.billing_state)
  const isIgst = gstType === 'IGST'

  let totalQty = 0
  let totalTaxable = 0
  let totalIgst = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalAmount = 0

  const tableHead = isIgst
    ? [['Sr. No.', 'Name of Product / Service', 'HSN / SAC', 'Qty', 'Rate', 'Taxable Value', 'IGST %', 'IGST Amt', 'Total']]
    : [['Sr. No.', 'Name of Product / Service', 'HSN / SAC', 'Qty', 'Rate', 'Taxable Value', 'CGST %', 'CGST Amt', 'SGST Amt', 'Total']]

  const tableBody = quotation.items.map((item, idx) => {
    const t = computeQuotationItemTotals(
      { quantity: Number(item.quantity), rate: Number(item.rate), discount: Number(item.discount) || 0, gstRate: Number(item.gst_rate) },
      gstType
    )
    const qty = Number(item.quantity)
    const unit = item.unit_short || 'PCS'
    const taxable = t.taxable
    totalQty += qty
    totalTaxable += taxable
    totalIgst += t.igst
    totalCgst += t.cgst
    totalSgst += t.sgst
    totalAmount += Number(item.amount)

    const name = item.description || item.product_name || '-'
    const row = [
      String(idx + 1),
      name,
      formatHsnSac(item.hsn_code, item.sac_code),
      `${qty} ${unit}`,
      formatMoney(item.rate),
      formatMoney(taxable),
    ] as string[]

    if (isIgst) {
      row.push(`${item.gst_rate}%`, formatMoney(t.igst), formatMoney(item.amount))
    } else {
      row.push(`${item.gst_rate / 2}%`, formatMoney(t.cgst), formatMoney(t.sgst), formatMoney(item.amount))
    }
    return row
  })

  const totalRow = isIgst
    ? ['', 'Total', '', String(roundToTwo(totalQty)), '', formatMoney(totalTaxable), '', formatMoney(totalIgst), formatMoney(totalAmount)]
    : ['', 'Total', '', String(roundToTwo(totalQty)), '', formatMoney(totalTaxable), '', formatMoney(totalCgst), formatMoney(totalSgst), formatMoney(totalAmount)]

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: [...tableBody, totalRow],
    margin: { left: MARGIN + 1, right: MARGIN + 1 },
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.2, textColor: TEXT },
    headStyles: { fillColor: [255, 255, 255], textColor: TEXT, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      ...(isIgst
        ? { 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right', fontStyle: 'bold' } }
        : { 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' } }),
    },
    didParseCell: (data) => {
      if (data.row.index === tableBody.length && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [245, 248, 252]
      }
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 4

  // ── Amount in words + Bank + Summary ──
  const footerTop = y
  const words = amountInWords(Number(quotation.total_amount))
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Total in words:', MARGIN + 3, y)
  doc.setFont('helvetica', 'normal')
  const wordLines = doc.splitTextToSize(words, contentW * 0.55)
  doc.text(wordLines, MARGIN + 3, y + 4)

  const bankX = MARGIN + 3
  let bankY = y + 4 + wordLines.length * 3.5 + 4
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...TEXT)
  doc.text('Bank Details:', bankX, bankY)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  bankY += 4
  const bankLines = [
    `Name: ${settings.bankName || '-'}`,
    `Branch: ${settings.bankBranch || '-'}`,
    `Acc. Number: ${settings.bankAccount || '-'}`,
    `IFSC: ${settings.bankIfsc || '-'}`,
    `MICR Code: ${settings.bankMicr || '-'}`,
    `UPI ID: ${settings.upiId || '-'}`,
  ]
  bankLines.forEach((line) => {
    doc.text(line, bankX, bankY)
    bankY += 3.5
  })

  // UPI placeholder box
  const qrX = MARGIN + contentW * 0.42
  const qrY = footerTop + 8
  doc.setDrawColor(...BORDER)
  doc.rect(qrX, qrY, 22, 22)
  doc.setFontSize(6)
  doc.text('Pay using UPI', qrX + 11, qrY + 26, { align: 'center' })

  // Tax summary (right)
  const sumX = pageW - MARGIN - 55
  let sumY = footerTop + 2
  const roundOff = Number(quotation.round_off) || 0
  const taxAmt = Number(quotation.tax_amount) || 0
  const summaryRows: [string, string][] = [
    ['Taxable Amount', formatMoney(quotation.subtotal)],
  ]
  if (isIgst) {
    summaryRows.push(['Add: IGST', formatMoney(taxAmt)])
  } else {
    summaryRows.push(['Add: CGST', formatMoney(taxAmt / 2)])
    summaryRows.push(['Add: SGST', formatMoney(taxAmt / 2)])
  }
  summaryRows.push(['Total Tax', formatMoney(taxAmt)])
  if (roundOff !== 0) summaryRows.push(['Round off Amount', formatMoney(roundOff)])

  doc.setFontSize(7)
  summaryRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, sumX, sumY)
    doc.text(`₹ ${val}`, pageW - MARGIN - 3, sumY, { align: 'right' })
    sumY += 4
  })

  sumY += 1
  doc.setFillColor(60, 60, 60)
  doc.setTextColor(255, 255, 255)
  doc.rect(sumX - 2, sumY - 3, pageW - MARGIN - sumX + 4, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Total Amount After Tax', sumX, sumY + 2)
  doc.text(`₹ ${formatMoney(quotation.total_amount)}`, pageW - MARGIN - 3, sumY + 2, { align: 'right' })
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(6)
  doc.text('(E & O.E.)', pageW - MARGIN - 3, sumY + 7, { align: 'right' })

  y = Math.max(bankY, sumY + 12)

  // ── Terms ──
  const terms = quotation.terms || settings.termsCondition
  if (terms) {
    doc.line(MARGIN + 1, y, pageW - MARGIN - 1, y)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT)
    doc.text('Terms & Condition:', MARGIN + 3, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    y += 4
    const termLines = doc.splitTextToSize(terms.replace(/\n/g, ' '), contentW - 80)
    doc.text(termLines.slice(0, 8), MARGIN + 3, y)
    y += termLines.slice(0, 8).length * 3.2
  }

  // ── Signatory ──
  const signY = pageH - MARGIN - 22
  doc.setFontSize(6.5)
  doc.text('Certified that the particulars given above are true and correct.', pageW - MARGIN - 3, signY, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text(`For ${settings.companyName}`, pageW - MARGIN - 3, signY + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Authorized Signatory', pageW - MARGIN - 3, signY + 18, { align: 'right' })

  return doc.output('arraybuffer')
}
