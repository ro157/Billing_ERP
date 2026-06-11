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
const FOOTER_LEFT_RATIO = 0.58
const FOOTER_WORDS_H = 11
const FOOTER_BANK_BODY_H = 36
const FOOTER_SIGN_IN_RIGHT_H = 17
const FOOTER_LIGHT_BLUE: [number, number, number] = [232, 240, 250]
const FOOTER_SUMMARY_ROW_H = 5.5
/** Helvetica lacks U+20B9; Rs. renders reliably in jsPDF */
const PDF_RUPEE = 'Rs.'

function itemsTableBorderAllowance(colCount: number): number {
  return (colCount + 1) * TABLE_BORDER_WIDTH
}

function getSummaryRowCount(isIgst: boolean): number {
  return isIgst ? 6 : 7
}

function getSummaryTableH(isIgst: boolean): number {
  return getSummaryRowCount(isIgst) * FOOTER_SUMMARY_ROW_H + 0.5
}

function getFooterMainH(isIgst: boolean): number {
  const leftH = FOOTER_WORDS_H + FOOTER_BANK_BODY_H
  const rightH = getSummaryTableH(isIgst) + FOOTER_SIGN_IN_RIGHT_H
  return Math.max(leftH, rightH)
}

type FooterLayout = {
  totalRowTop: number
  mainFooterTop: number
  mainFooterH: number
  termsTop: number
  footerBottom: number
  termsBlockH: number
  termLines: string[]
}

function computeFooterLayout(
  doc: jsPDF,
  pageH: number,
  contentW: number,
  terms: string | null | undefined,
  isIgst: boolean
): FooterLayout {
  const bottom = pageH - MARGIN
  const mainFooterH = getFooterMainH(isIgst)
  const termsText = terms?.trim()
  const termLines = termsText
    ? doc.splitTextToSize(termsText.replace(/\r\n/g, '\n'), contentW - 8).slice(0, 12)
    : []
  const termsBlockH = termsText ? 7 + termLines.length * 3.2 + 3 : 0

  const footerBottom = bottom
  const termsTop = footerBottom - termsBlockH
  const mainFooterTop = termsTop - mainFooterH
  const totalRowTop = mainFooterTop - FOOTER_TOTAL_ROW_H

  return { totalRowTop, mainFooterTop, mainFooterH, termsTop, footerBottom, termsBlockH, termLines }
}

type SummaryTableRow = {
  label: string
  value: string
  valueFontSize?: number
  valueOnly?: boolean
  whiteBg?: boolean
}

function drawTaxSummaryTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  maxHeight: number,
  isIgst: boolean,
  totalTaxable: number,
  taxAmt: number,
  roundOff: number,
  totalAmount: number
): number {
  const rows: SummaryTableRow[] = [{ label: 'Taxable Amount', value: formatMoney(totalTaxable) }]
  if (isIgst) {
    rows.push({ label: 'Add : IGST', value: formatMoney(taxAmt) })
  } else {
    rows.push({ label: 'Add : CGST', value: formatMoney(taxAmt / 2) })
    rows.push({ label: 'Add : SGST', value: formatMoney(taxAmt / 2) })
  }
  rows.push({ label: 'Total Tax', value: formatMoney(taxAmt) })
  rows.push({ label: 'Round off Amount', value: formatMoney(roundOff) })
  rows.push({
    label: 'Total Amount After Tax',
    value: `${PDF_RUPEE} ${formatMoney(totalAmount)}`,
    valueFontSize: 6.2,
  })
  rows.push({ label: '', value: '(E & O.E.)', valueOnly: true, whiteBg: true })

  const rowH = maxHeight / rows.length
  const labelColW = width * 0.56
  const pad = 1.8
  const valueRightX = x + width - pad
  const valueMaxW = width - labelColW - pad * 2
  let cy = y

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.setTextColor(...TEXT)

  rows.forEach((row) => {
    const bg = row.whiteBg ? [255, 255, 255] : FOOTER_LIGHT_BLUE
    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.rect(x, cy, width, rowH, 'FD')
    doc.line(x + labelColW, cy, x + labelColW, cy + rowH)

    const textY = cy + rowH / 2 + 1.4

    if (!row.valueOnly && row.label) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.8)
      const labelLines = doc.splitTextToSize(row.label, labelColW - pad * 2)
      doc.text(labelLines[0], x + pad, textY)
    }

    doc.setFont('helvetica', row.valueOnly ? 'normal' : 'bold')
    doc.setFontSize(row.valueFontSize ?? 5.8)
    doc.text(row.value, valueRightX, textY, { align: 'right', maxWidth: valueMaxW })

    cy += rowH
  })

  return cy
}

function getItemsTableColumnStyles(contentW: number, isIgst: boolean): Record<number, object> {
  const tableW = contentW - itemsTableBorderAllowance(isIgst ? 9 : 10)
  if (isIgst) {
    const w = {
      0: 7,
      2: 11,
      3: 11,
      4: 13,
      5: 15,
      6: 8,
      7: 14,
      8: 17,
    }
    const fixed = Object.values(w).reduce((s, n) => s + n, 0)
    return {
      0: { cellWidth: w[0], halign: 'center', valign: 'top' },
      1: { cellWidth: tableW - fixed, valign: 'top' },
      2: { cellWidth: w[2], halign: 'center' },
      3: { cellWidth: w[3], halign: 'right' },
      4: { cellWidth: w[4], halign: 'right' },
      5: { cellWidth: w[5], halign: 'right' },
      6: { cellWidth: w[6], halign: 'center' },
      7: { cellWidth: w[7], halign: 'right' },
      8: { cellWidth: w[8], halign: 'right', fontStyle: 'bold', overflow: 'linebreak' },
    }
  }

  const w = {
    0: 7,
    2: 10,
    3: 10,
    4: 12,
    5: 14,
    6: 7,
    7: 11,
    8: 11,
    9: 15,
  }
  const fixed = Object.values(w).reduce((s, n) => s + n, 0)
  return {
    0: { cellWidth: w[0], halign: 'center', valign: 'top' },
    1: { cellWidth: tableW - fixed, valign: 'top' },
    2: { cellWidth: w[2], halign: 'center' },
    3: { cellWidth: w[3], halign: 'right' },
    4: { cellWidth: w[4], halign: 'right' },
    5: { cellWidth: w[5], halign: 'right' },
    6: { cellWidth: w[6], halign: 'center' },
    7: { cellWidth: w[7], halign: 'right' },
    8: { cellWidth: w[8], halign: 'right' },
    9: { cellWidth: w[9], halign: 'right', fontStyle: 'bold', overflow: 'linebreak' },
  }
}

function getProductColumnWidth(contentW: number, isIgst: boolean): number {
  const colCount = isIgst ? 9 : 10
  const tableW = contentW - itemsTableBorderAllowance(colCount)
  const fixed = isIgst ? 96 : 97
  return tableW - fixed
}

function estimateProductsBlockHeight(
  doc: jsPDF,
  items: QuotationPdfItem[],
  contentW: number,
  isIgst: boolean
): number {
  const productColW = getProductColumnWidth(contentW, isIgst)
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
  settings: QuotationPdfSettings,
  quotation: QuotationPdfData,
  isIgst: boolean,
  totalTaxable: number,
  taxAmt: number,
  layout: FooterLayout
): void {
  const words = amountInWords(Number(quotation.total_amount)).toUpperCase()
  const roundOff = Number(quotation.round_off) || 0
  const pad = 2
  const top = layout.mainFooterTop
  const mainH = layout.mainFooterH
  const leftW = contentW * FOOTER_LEFT_RATIO
  const rightW = contentW - leftW
  const splitX = bodyLeft + leftW
  const bankTop = top + FOOTER_WORDS_H
  const bankH = mainH - FOOTER_WORDS_H
  const bankQrW = leftW * 0.3
  const bankTextW = leftW - bankQrW
  const bankTextX = bodyLeft
  const qrColX = bodyLeft + bankTextW

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.setFillColor(255, 255, 255)

  // Main 2-column footer box
  doc.rect(bodyLeft, top, contentW, mainH, 'FD')
  doc.line(splitX, top, splitX, top + mainH)

  // Left — Total in words
  doc.line(bodyLeft, bankTop, splitX, bankTop)
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text('Total in words', bodyLeft + leftW / 2, top + 4.2, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  const wordLines = doc.splitTextToSize(words, leftW - pad * 2)
  doc.text(wordLines.slice(0, 2), bodyLeft + leftW / 2, top + 7.5, { align: 'center' })

  // Left — Bank details + QR
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('Bank Details', bodyLeft + bankTextW / 2, bankTop + 4, { align: 'center' })
  doc.line(qrColX, bankTop, qrColX, top + mainH)

  let bankY = bankTop + 7
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
    doc.setFontSize(5.8)
    doc.text(`${label} :`, bankTextX + pad, bankY)
    doc.setFont('helvetica', 'normal')
    const labelW = doc.getTextWidth(`${label} :`) + 0.5
    const wrapped = doc.splitTextToSize(value, bankTextW - pad * 2 - labelW)
    doc.text(wrapped[0] || '-', bankTextX + pad + labelW, bankY)
    bankY += 3
  })

  const qrSize = 16
  const qrBoxX = qrColX + (bankQrW - qrSize) / 2
  const qrBoxY = bankTop + (bankH - qrSize - 5) / 2
  doc.rect(qrBoxX, qrBoxY, qrSize, qrSize)
  doc.setFontSize(5)
  doc.text('Pay using UPI', qrColX + bankQrW / 2, qrBoxY + qrSize + 3, { align: 'center' })

  // Right — Tax summary + signatory
  const signTop = top + mainH - FOOTER_SIGN_IN_RIGHT_H
  drawTaxSummaryTable(
    doc,
    splitX,
    top,
    rightW,
    signTop - top,
    isIgst,
    totalTaxable,
    taxAmt,
    roundOff,
    Number(quotation.total_amount)
  )
  doc.line(splitX, signTop, bodyRight, signTop)
  doc.setFontSize(5.8)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Certified that the particulars given above are true and correct.',
    bodyRight - pad,
    signTop + 4.5,
    { align: 'right' }
  )
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(`For ${settings.companyName}`, bodyRight - pad, signTop + 9, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.text('Authorized Signatory', bodyRight - pad, signTop + 14, { align: 'right' })

  // Terms & Condition (full width below main footer)
  const termsText = (quotation.terms || settings.termsCondition)?.trim()
  if (termsText && layout.termsBlockH > 0) {
    doc.rect(bodyLeft, layout.termsTop, contentW, layout.termsBlockH, 'FD')
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
  const mainFooterH = getFooterMainH(isIgst)
  const footerLayout = computeFooterLayout(doc, pageH, contentW, termsSource, isIgst)

  let spacerHeight = 0
  const spacerRows: string[][] = []
  if (useCompactLayout) {
    const usedHeight = estimateProductsBlockHeight(doc, quotation.items, contentW, isIgst)
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
    margin: { left: bodyLeft, right: pageW - bodyRight },
    tableWidth: contentW - itemsTableBorderAllowance(colCount),
    styles: {
      fontSize: ITEM_TABLE_FONT_SIZE,
      cellPadding: ITEM_TABLE_CELL_PADDING,
      lineColor: BORDER,
      lineWidth: TABLE_BORDER_WIDTH,
      textColor: TEXT,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: TEXT,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: TABLE_FULL_BORDER,
      fontSize: 6,
    },
    columnStyles: getItemsTableColumnStyles(contentW, isIgst),
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

  const layout = useCompactLayout
    ? footerLayout
    : {
        ...footerLayout,
        totalRowTop: tableEndY - FOOTER_TOTAL_ROW_H,
        mainFooterTop: tableEndY,
        mainFooterH,
        termsTop: tableEndY + mainFooterH,
        footerBottom: tableEndY + mainFooterH + footerLayout.termsBlockH,
      }

  drawQuotationFooter(
    doc,
    bodyLeft,
    bodyRight,
    contentW,
    settings,
    quotation,
    isIgst,
    totalTaxable,
    taxAmt,
    layout
  )

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(bodyLeft, itemsTableStartY, bodyLeft, layout.footerBottom)
  doc.line(bodyRight, itemsTableStartY, bodyRight, layout.footerBottom)

  return doc.output('arraybuffer')
}
