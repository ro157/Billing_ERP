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

const ITEM_TABLE_FONT_SIZE = 6.5
const ITEM_TABLE_LINE_HEIGHT = 3.2
const ITEM_TABLE_CELL_PADDING = 1.5

function getProductCellParts(item: QuotationPdfItem | null | undefined): { productName: string; description: string | null } {
  if (!item) return { productName: '-', description: null }
  const productName = item.product_name?.trim() || '-'
  const description = item.description?.trim() || null
  if (!description || description.toLowerCase() === productName.toLowerCase()) {
    return { productName, description: null }
  }
  return { productName, description }
}

function estimateProductCellHeight(doc: jsPDF, item: QuotationPdfItem, maxWidth: number): number {
  const { productName, description } = getProductCellParts(item)
  const textWidth = Math.max(8, maxWidth - ITEM_TABLE_CELL_PADDING * 2)
  doc.setFontSize(ITEM_TABLE_FONT_SIZE)

  doc.setFont('helvetica', 'bold')
  const nameLines = doc.splitTextToSize(productName, textWidth)

  let lines = nameLines.length
  if (description) {
    doc.setFont('helvetica', 'normal')
    lines += doc.splitTextToSize(description, textWidth).length
  }

  return ITEM_TABLE_CELL_PADDING * 2 + lines * ITEM_TABLE_LINE_HEIGHT
}

function drawProductCell(
  doc: jsPDF,
  item: QuotationPdfItem,
  x: number,
  y: number,
  width: number
): void {
  const { productName, description } = getProductCellParts(item)
  const textWidth = Math.max(8, width - ITEM_TABLE_CELL_PADDING * 2)
  const textX = x + ITEM_TABLE_CELL_PADDING
  let textY = y + ITEM_TABLE_CELL_PADDING + 2.2

  doc.setFontSize(ITEM_TABLE_FONT_SIZE)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  const nameLines = doc.splitTextToSize(productName, textWidth)
  doc.text(nameLines, textX, textY)
  textY += nameLines.length * ITEM_TABLE_LINE_HEIGHT

  if (description) {
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(description, textWidth)
    doc.text(descLines, textX, textY)
  }
}

const TABLE_BORDER_WIDTH = 0.2
const TABLE_VERTICAL_BORDER = {
  top: 0,
  right: TABLE_BORDER_WIDTH,
  bottom: 0,
  left: TABLE_BORDER_WIDTH,
} as const
const TABLE_FULL_BORDER = {
  top: TABLE_BORDER_WIDTH,
  right: TABLE_BORDER_WIDTH,
  bottom: TABLE_BORDER_WIDTH,
  left: TABLE_BORDER_WIDTH,
} as const

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

const FOOTER_TOTAL_ROW_H = 7
const FOOTER_WORDS_ROW_H = 11
const FOOTER_BANK_ROW_H = 42
const FOOTER_SIGNATORY_H = 20

type FooterLayout = {
  totalRowTop: number
  wordsRowTop: number
  bankRowTop: number
  signatoryTop: number
  termsTop: number
  footerBottom: number
  termsBlockH: number
  termLines: string[]
}

function computeFooterLayout(doc: jsPDF, pageH: number, contentW: number, terms?: string | null): FooterLayout {
  const bottom = pageH - MARGIN
  const termsText = terms?.trim()
  const termLines = termsText
    ? doc.splitTextToSize(termsText.replace(/\r\n/g, '\n'), contentW - 8).slice(0, 12)
    : []
  const termsBlockH = termsText ? 7 + termLines.length * 3.2 + 3 : 0

  const footerBottom = bottom
  const termsTop = footerBottom - termsBlockH
  const signatoryTop = termsTop - FOOTER_SIGNATORY_H
  const bankRowTop = signatoryTop - FOOTER_BANK_ROW_H
  const wordsRowTop = bankRowTop - FOOTER_WORDS_ROW_H
  const totalRowTop = wordsRowTop - FOOTER_TOTAL_ROW_H

  return { totalRowTop, wordsRowTop, bankRowTop, signatoryTop, termsTop, footerBottom, termsBlockH, termLines }
}

function estimateProductsBlockHeight(doc: jsPDF, items: QuotationPdfItem[], contentW: number): number {
  const productColW = contentW * 0.28
  let productsH = 0
  for (const item of items) {
    productsH += Math.max(7, estimateProductCellHeight(doc, item, productColW))
  }
  return 7 + productsH
}

function drawQuotationFooter(
  doc: jsPDF,
  bodyLeft: number,
  bodyRight: number,
  contentW: number,
  pageW: number,
  settings: QuotationPdfSettings,
  quotation: QuotationPdfData,
  isIgst: boolean,
  totalTaxable: number,
  taxAmt: number,
  layout: FooterLayout
): void {
  const words = amountInWords(Number(quotation.total_amount))
  const roundOff = Number(quotation.round_off) || 0
  const pad = 2

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)

  // Total in words row
  doc.rect(bodyLeft, layout.wordsRowTop, contentW, FOOTER_WORDS_ROW_H)
  doc.setFontSize(7)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text('Total in words', bodyLeft + pad, layout.wordsRowTop + 4)
  doc.setFont('helvetica', 'normal')
  const wordLines = doc.splitTextToSize(words, contentW - pad * 2)
  doc.text(wordLines.slice(0, 2), bodyLeft + pad, layout.wordsRowTop + 7.5)

  // Bank details | UPI | Tax summary
  const bankColW = contentW * 0.48
  const qrColW = contentW * 0.22
  const sumColW = contentW - bankColW - qrColW
  const bankX = bodyLeft
  const qrX = bodyLeft + bankColW
  const sumX = qrX + qrColW

  doc.rect(bodyLeft, layout.bankRowTop, contentW, FOOTER_BANK_ROW_H)
  doc.line(qrX, layout.bankRowTop, qrX, layout.bankRowTop + FOOTER_BANK_ROW_H)
  doc.line(sumX, layout.bankRowTop, sumX, layout.bankRowTop + FOOTER_BANK_ROW_H)

  let bankY = layout.bankRowTop + 4
  doc.setFont('helvetica', 'bold')
  doc.text('Bank Details', bankX + pad, bankY)
  doc.setFont('helvetica', 'normal')
  bankY += 4
  const bankLines = [
    ['Name', settings.bankName || '-'],
    ['Branch', settings.bankBranch || '-'],
    ['Acc. Number', settings.bankAccount || '-'],
    ['IFSC', settings.bankIfsc || '-'],
    ['MICR Code', settings.bankMicr || '-'],
    ['UPI ID', settings.upiId || '-'],
  ]
  bankLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label} :`, bankX + pad, bankY)
    doc.setFont('helvetica', 'normal')
    const labelW = doc.getTextWidth(`${label} :`) + 1
    const wrapped = doc.splitTextToSize(value, bankColW - pad * 2 - labelW)
    doc.text(wrapped[0] || '-', bankX + pad + labelW, bankY)
    bankY += wrapped.length > 1 ? 3.2 * wrapped.length : 3.2
  })

  const qrSize = 18
  const qrBoxX = qrX + (qrColW - qrSize) / 2
  const qrBoxY = layout.bankRowTop + 6
  doc.rect(qrBoxX, qrBoxY, qrSize, qrSize)
  doc.setFontSize(5.5)
  doc.text('Pay using UPI', qrX + qrColW / 2, qrBoxY + qrSize + 3.5, { align: 'center' })

  let sumY = layout.bankRowTop + 4
  const summaryRows: [string, string][] = [['Taxable Amount', formatMoney(totalTaxable)]]
  if (isIgst) {
    summaryRows.push(['Add : IGST', formatMoney(taxAmt)])
  } else {
    summaryRows.push(['Add : CGST', formatMoney(taxAmt / 2)])
    summaryRows.push(['Add : SGST', formatMoney(taxAmt / 2)])
  }
  summaryRows.push(['Total Tax', formatMoney(taxAmt)])
  summaryRows.push(['Round off Amount', formatMoney(roundOff)])

  doc.setFontSize(7)
  summaryRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT)
    doc.text(label, sumX + pad, sumY)
    doc.text(val, bodyRight - pad, sumY, { align: 'right' })
    sumY += 3.8
  })

  const totalBarY = layout.bankRowTop + FOOTER_BANK_ROW_H - 10
  doc.setFillColor(60, 60, 60)
  doc.rect(sumX + 1, totalBarY, sumColW - 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Total Amount After Tax', sumX + pad, totalBarY + 4.8)
  doc.text(`₹ ${formatMoney(quotation.total_amount)}`, bodyRight - pad, totalBarY + 4.8, { align: 'right' })
  doc.setTextColor(...TEXT)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.text('(E & O.E.)', bodyRight - pad, layout.bankRowTop + FOOTER_BANK_ROW_H - 2.5, { align: 'right' })

  // Signatory
  doc.rect(bodyLeft, layout.signatoryTop, contentW, FOOTER_SIGNATORY_H)
  doc.setFontSize(6.5)
  doc.text(
    'Certified that the particulars given above are true and correct.',
    bodyRight - pad,
    layout.signatoryTop + 5,
    { align: 'right' }
  )
  doc.setFont('helvetica', 'bold')
  doc.text(`For ${settings.companyName}`, bodyRight - pad, layout.signatoryTop + 10, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Authorized Signatory', bodyRight - pad, layout.signatoryTop + 16, { align: 'right' })

  // Terms & Condition
  const termsText = (quotation.terms || settings.termsCondition)?.trim()
  if (termsText && layout.termsBlockH > 0) {
    doc.rect(bodyLeft, layout.termsTop, contentW, layout.termsBlockH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('Terms & Condition', bodyLeft + contentW / 2, layout.termsTop + 4.5, { align: 'center' })
    doc.line(bodyLeft, layout.termsTop + 6, bodyRight, layout.termsTop + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    let termY = layout.termsTop + 9
    layout.termLines.forEach((line) => {
      doc.text(line, bodyLeft + pad, termY)
      termY += 3.2
    })
  }

  doc.line(bodyLeft, layout.wordsRowTop, bodyLeft, layout.footerBottom)
  doc.line(bodyRight, layout.wordsRowTop, bodyRight, layout.footerBottom)
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

    const row = [
      String(idx + 1),
      getProductCellParts(item).productName,
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

  const itemsTableStartY = y
  const colCount = isIgst ? 9 : 10
  const termsSource = quotation.terms || settings.termsCondition
  const useCompactLayout = quotation.items.length <= 2
  const footerLayout = computeFooterLayout(doc, pageH, contentW, termsSource)

  let spacerHeight = 0
  const spacerRows: string[][] = []
  if (useCompactLayout) {
    const usedHeight = estimateProductsBlockHeight(doc, quotation.items, contentW)
    spacerHeight = Math.max(12, footerLayout.totalRowTop - itemsTableStartY - usedHeight - FOOTER_TOTAL_ROW_H)
    if (spacerHeight > 0) {
      spacerRows.push(Array(colCount).fill(''))
    }
  }

  const totalRowIndex = tableBody.length + spacerRows.length

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: [...tableBody, ...spacerRows, totalRow],
    margin: { left: MARGIN + 1, right: MARGIN + 1 },
    styles: {
      fontSize: ITEM_TABLE_FONT_SIZE,
      cellPadding: ITEM_TABLE_CELL_PADDING,
      lineColor: BORDER,
      lineWidth: TABLE_BORDER_WIDTH,
      textColor: TEXT,
      valign: 'top',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: TEXT,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: TABLE_FULL_BORDER,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', valign: 'top' },
      1: { valign: 'top' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      ...(isIgst
        ? { 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right', fontStyle: 'bold' } }
        : { 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' } }),
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.lineWidth = TABLE_FULL_BORDER
        return
      }

      if (data.section !== 'body') return

      const isSpacerRow =
        spacerRows.length > 0 &&
        data.row.index >= tableBody.length &&
        data.row.index < totalRowIndex
      if (isSpacerRow) {
        data.cell.text = ['']
        data.cell.styles.lineWidth = TABLE_VERTICAL_BORDER
        data.cell.styles.minCellHeight = spacerHeight
        return
      }

      const isTotalRow = data.row.index === totalRowIndex
      if (isTotalRow) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [245, 248, 252]
        data.cell.styles.lineWidth = {
          ...TABLE_VERTICAL_BORDER,
          top: TABLE_BORDER_WIDTH,
          bottom: TABLE_BORDER_WIDTH,
        }
        return
      }

      data.cell.styles.lineWidth = TABLE_VERTICAL_BORDER
      data.cell.styles.valign = 'top'

      if (data.column.index === 1) {
        const item = quotation.items[data.row.index]
        data.cell.text = ['']
        data.cell.styles.minCellHeight = estimateProductCellHeight(
          doc,
          item,
          data.cell.width
        )
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 1) return
      if (data.row.index >= tableBody.length) return

      const item = quotation.items[data.row.index]
      const fillColor = data.cell.styles.fillColor
      if (Array.isArray(fillColor)) {
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2])
        doc.rect(data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4, 'F')
      }

      drawProductCell(doc, item, data.cell.x, data.cell.y, data.cell.width)
    },
  })

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  const taxAmt = Number(quotation.tax_amount) || 0

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(bodyLeft, itemsTableStartY, bodyLeft, tableEndY)
  doc.line(bodyRight, itemsTableStartY, bodyRight, tableEndY)

  const layout = useCompactLayout
    ? footerLayout
    : {
        ...footerLayout,
        totalRowTop: tableEndY - FOOTER_TOTAL_ROW_H,
        wordsRowTop: tableEndY,
        bankRowTop: tableEndY + FOOTER_WORDS_ROW_H,
        signatoryTop: tableEndY + FOOTER_WORDS_ROW_H + FOOTER_BANK_ROW_H,
        termsTop: tableEndY + FOOTER_WORDS_ROW_H + FOOTER_BANK_ROW_H + FOOTER_SIGNATORY_H,
        footerBottom:
          tableEndY +
          FOOTER_WORDS_ROW_H +
          FOOTER_BANK_ROW_H +
          FOOTER_SIGNATORY_H +
          footerLayout.termsBlockH,
      }

  drawQuotationFooter(
    doc,
    bodyLeft,
    bodyRight,
    contentW,
    pageW,
    settings,
    quotation,
    isIgst,
    totalTaxable,
    taxAmt,
    layout
  )

  return doc.output('arraybuffer')
}
