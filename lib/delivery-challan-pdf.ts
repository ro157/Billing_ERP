import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawDocumentHeader } from '@/lib/document-header-pdf'
import type { QuotationPdfCustomer, QuotationPdfSettings } from '@/lib/quotation-pdf'
import { INDIAN_STATES, roundToTwo } from '@/lib/utils'

const TITLE_BLUE: [number, number, number] = [41, 98, 160]
const TEXT: [number, number, number] = [30, 30, 30]
const BORDER: [number, number, number] = [0, 0, 0]
const MARGIN = 8
const DETAIL_FONT_SIZE = 7
const DETAIL_LINE_HEIGHT = 3.4
const DETAIL_CELL_PADDING = 2
const DETAIL_CONTENT_TOP_PAD = 4
const ITEM_TABLE_FONT_SIZE = 6.5
const ITEM_TABLE_LINE_HEIGHT = 3.2
const ITEM_TABLE_CELL_PADDING = 1.5
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
const FOOTER_TOTAL_ROW_H = 7
const FOOTER_LEFT_RATIO = 0.58
const FOOTER_SIGN_BOX_H = 22

export interface DeliveryChallanPdfItem {
  description?: string | null
  product_name?: string | null
  hsn_code?: string | null
  sac_code?: string | null
  unit_short?: string | null
  quantity: number
}

export interface DeliveryChallanPdfData {
  challan_no: string
  date: string
  completion_date?: string | null
  terms?: string | null
  customer: QuotationPdfCustomer
  consignee?: QuotationPdfCustomer
  items: DeliveryChallanPdfItem[]
}

type LabeledLine = { label: string; value: string; valueBold?: boolean }

function formatPdfDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`
}

function formatHsnSac(hsn?: string | null, sac?: string | null): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || '-'
}

function formatQtyWithUnit(qty: number, unit?: string | null): string {
  const u = (unit || 'NOS').toUpperCase()
  return `${Number(qty).toFixed(2)} ${u}`
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

function getChallanMetaFields(challan: DeliveryChallanPdfData): LabeledLine[] {
  const lines: LabeledLine[] = [
    { label: 'Challan No.', value: challan.challan_no, valueBold: true },
    { label: 'Challan Date', value: formatPdfDate(challan.date), valueBold: true },
  ]
  if (challan.completion_date) {
    lines.push({
      label: 'Completion Date',
      value: formatPdfDate(challan.completion_date),
      valueBold: true,
    })
  }
  return lines
}

function estimateLabeledBlockHeight(doc: jsPDF, lines: LabeledLine[], maxWidth: number): number {
  let height = DETAIL_CELL_PADDING * 2 + DETAIL_CONTENT_TOP_PAD
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
  let cy = y + DETAIL_CELL_PADDING + DETAIL_CONTENT_TOP_PAD
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

function getProductCellParts(item: DeliveryChallanPdfItem | null | undefined): {
  productName: string
  description: string | null
} {
  if (!item) return { productName: '-', description: null }
  const productName = item.product_name?.trim() || '-'
  const description = item.description?.trim() || null
  if (!description || description.toLowerCase() === productName.toLowerCase()) {
    return { productName, description: null }
  }
  return { productName, description }
}

function estimateProductCellHeight(doc: jsPDF, item: DeliveryChallanPdfItem, maxWidth: number): number {
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
  item: DeliveryChallanPdfItem,
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

function formatTermLinesForPdf(termsText: string): string[] {
  const raw = termsText.replace(/\r\n/g, '\n').trim()
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('#') ? line : `# ${line}`))
}

function estimateChallanFooterH(doc: jsPDF, termsText: string, leftW: number): number {
  const pad = 2
  const headerH = 8
  const sigH = 10
  const lines = formatTermLinesForPdf(termsText)
  if (lines.length === 0) return headerH + FOOTER_SIGN_BOX_H + sigH + 6

  doc.setFontSize(5.8)
  let bodyH = headerH
  for (const line of lines.slice(0, 12)) {
    bodyH += doc.splitTextToSize(line, leftW - pad * 2).length * 3
  }
  return Math.max(bodyH + sigH + 4, FOOTER_SIGN_BOX_H + headerH + sigH)
}

function itemsTableBorderAllowance(colCount: number): number {
  return (colCount + 1) * TABLE_BORDER_WIDTH
}

function getChallanItemsColumnStyles(contentW: number): Record<number, object> {
  const colCount = 4
  const tableW = contentW - itemsTableBorderAllowance(colCount)
  const fixed = 10 + 22 + 24
  return {
    0: { cellWidth: 10, halign: 'center', valign: 'top' },
    1: { cellWidth: tableW - fixed, valign: 'top' },
    2: { cellWidth: 22, halign: 'center', valign: 'middle' },
    3: { cellWidth: 24, halign: 'center', valign: 'middle' },
  }
}

function getProductColumnWidth(contentW: number): number {
  const tableW = contentW - itemsTableBorderAllowance(4)
  return tableW - 56
}

function estimateProductsBlockHeight(doc: jsPDF, items: DeliveryChallanPdfItem[], contentW: number): number {
  const productColW = getProductColumnWidth(contentW)
  let productsH = 0
  for (const item of items) {
    productsH += Math.max(7, estimateProductCellHeight(doc, item, productColW))
  }
  return 7 + productsH
}

function drawChallanFooter(
  doc: jsPDF,
  bodyLeft: number,
  bodyRight: number,
  contentW: number,
  settings: QuotationPdfSettings,
  termsSource: string,
  footerTop: number,
  footerH: number
): number {
  const pad = 2
  const leftW = contentW * FOOTER_LEFT_RATIO
  const rightW = contentW - leftW
  const splitX = bodyLeft + leftW
  const termLines = formatTermLinesForPdf(termsSource)

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.setFillColor(255, 255, 255)
  doc.rect(bodyLeft, footerTop, contentW, footerH, 'FD')
  doc.line(splitX, footerTop, splitX, footerTop + footerH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT)
  doc.text('Terms & Condition', bodyLeft + leftW / 2, footerTop + 4, { align: 'center' })
  doc.line(bodyLeft, footerTop + 5.5, splitX, footerTop + 5.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  let termY = footerTop + 8
  const linesToDraw = termLines.length > 0 ? termLines : ['# Goods delivered as per challan details.']
  for (const line of linesToDraw.slice(0, 12)) {
    const wrapped = doc.splitTextToSize(line, leftW - pad * 2)
    doc.text(wrapped, bodyLeft + pad, termY)
    termY += wrapped.length * 3
  }
  doc.text('Customer Signature', bodyLeft + pad, footerTop + footerH - 3)

  const certY = footerTop + 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.text(
    'Certified that the particulars given above are true and correct.',
    splitX + rightW / 2,
    certY,
    { align: 'center', maxWidth: rightW - pad * 2 }
  )
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(`For ${settings.companyName}`, splitX + rightW / 2, certY + 6, { align: 'center' })

  const sigBoxY = certY + 9
  const sigBoxW = rightW - pad * 2
  doc.setDrawColor(...BORDER)
  doc.rect(splitX + pad, sigBoxY, sigBoxW, FOOTER_SIGN_BOX_H)

  return footerTop + footerH
}

function drawPageNumber(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT)
  doc.text('Page 1 of 1', pageW - MARGIN, pageH - 3.5, { align: 'right' })
}

function renderDeliveryChallanPage(
  doc: jsPDF,
  challan: DeliveryChallanPdfData,
  settings: QuotationPdfSettings
): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2
  const bodyLeft = MARGIN
  const bodyRight = MARGIN + contentW

  const boxTop = drawDocumentHeader(doc, settings, MARGIN, pageW)
  let y = boxTop

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
  doc.setTextColor(...TITLE_BLUE)
  doc.text('Delivery Challan', pageW / 2, titleMidY, { align: 'center' })

  doc.setFontSize(6)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text('ORIGINAL FOR RECIPIENT', bodyRight - 2, titleMidY, { align: 'right' })

  y += titleRowH
  doc.line(bodyLeft, y, bodyRight, y)

  const colW = contentW / 3
  const cellPad = DETAIL_CELL_PADDING
  const textW = colW - cellPad * 2
  const consigneeParty = challan.consignee || challan.customer
  const buyerFields = getPartyFields(challan.customer, false)
  const consigneeFields = getPartyFields(consigneeParty, true)
  const metaFields = getChallanMetaFields(challan)
  const detailsRowHeight = Math.max(
    estimateLabeledBlockHeight(doc, buyerFields, textW),
    estimateLabeledBlockHeight(doc, consigneeFields, textW),
    estimateLabeledBlockHeight(doc, metaFields, textW)
  )

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
        { content: '', styles: { minCellHeight: 7 } },
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
  doc.line(bodyLeft, boxTop, bodyLeft, y)
  doc.line(bodyRight, boxTop, bodyRight, y)
  y += 2

  let totalQty = 0
  const defaultUnit = challan.items[0]?.unit_short || 'NOS'
  const tableBody = challan.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0
    totalQty += qty
    return [
      String(idx + 1),
      getProductCellParts(item).productName,
      formatHsnSac(item.hsn_code, item.sac_code),
      formatQtyWithUnit(qty, item.unit_short || defaultUnit),
    ] as string[]
  })

  const totalRow = ['', 'Total', '', formatQtyWithUnit(roundToTwo(totalQty), defaultUnit)]
  const termsSource = (challan.terms || settings.termsCondition || '').trim()
  const leftW = contentW * FOOTER_LEFT_RATIO
  const footerH = estimateChallanFooterH(doc, termsSource, leftW)
  const footerBottom = pageH - MARGIN
  const footerTop = footerBottom - footerH
  const totalRowTop = footerTop - FOOTER_TOTAL_ROW_H
  const useCompactLayout = challan.items.length <= 3

  let spacerHeight = 0
  const spacerRows: string[][] = []
  if (useCompactLayout) {
    const usedHeight = estimateProductsBlockHeight(doc, challan.items, contentW)
    spacerHeight = Math.max(12, totalRowTop - y - usedHeight - FOOTER_TOTAL_ROW_H)
    if (spacerHeight > 0) {
      spacerRows.push(['', '', '', ''])
    }
  }

  const totalRowIndex = tableBody.length + spacerRows.length
  const itemsTableStartY = y

  autoTable(doc, {
    startY: y,
    head: [['Sr. No.', 'Name of Product / Service', 'HSN / SAC', 'Qty']],
    body: [...tableBody, ...spacerRows, totalRow],
    margin: { left: bodyLeft, right: pageW - bodyRight },
    tableWidth: contentW - itemsTableBorderAllowance(4),
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
    columnStyles: getChallanItemsColumnStyles(contentW),
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
        data.cell.styles.valign = 'middle'
        data.cell.styles.minCellHeight = FOOTER_TOTAL_ROW_H
        data.cell.styles.lineWidth = {
          ...TABLE_VERTICAL_BORDER,
          top: TABLE_BORDER_WIDTH,
          bottom: TABLE_BORDER_WIDTH,
        }
        return
      }

      data.cell.styles.lineWidth = TABLE_VERTICAL_BORDER
      if (data.column.index === 1) {
        const item = challan.items[data.row.index]
        data.cell.text = ['']
        data.cell.styles.minCellHeight = estimateProductCellHeight(doc, item, data.cell.width)
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return

      if (data.row.index === totalRowIndex) {
        const raw = data.cell.text
        const text = (Array.isArray(raw) ? raw.join('\n') : String(raw ?? '')).trim()
        if (!text) return

        doc.setFillColor(245, 248, 252)
        doc.rect(data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4, 'F')

        const align: 'left' | 'center' | 'right' =
          data.column.index === 1 ? 'left' : data.column.index === 3 ? 'center' : 'center'
        const pad = 1.5
        const textX =
          align === 'center'
            ? data.cell.x + data.cell.width / 2
            : data.cell.x + pad
        const textY = data.cell.y + Math.min(3.6, data.cell.height - 2.2)

        doc.setFontSize(ITEM_TABLE_FONT_SIZE)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT)
        doc.text(text, textX, textY, { align })
        return
      }

      if (data.column.index !== 1 || data.row.index >= tableBody.length) return
      const item = challan.items[data.row.index]
      drawProductCell(doc, item, data.cell.x, data.cell.y, data.cell.width)
    },
  })

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  const layoutFooterTop = useCompactLayout ? footerTop : tableEndY
  const layoutFooterH = footerH

  const footerBottomY = drawChallanFooter(
    doc,
    bodyLeft,
    bodyRight,
    contentW,
    settings,
    termsSource,
    layoutFooterTop,
    layoutFooterH
  )

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(bodyLeft, itemsTableStartY, bodyLeft, footerBottomY)
  doc.line(bodyRight, itemsTableStartY, bodyRight, footerBottomY)

  drawPageNumber(doc)
}

export function generateDeliveryChallanPdfBuffer(
  challan: DeliveryChallanPdfData,
  settings: QuotationPdfSettings
): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  renderDeliveryChallanPage(doc, challan, settings)
  return doc.output('arraybuffer')
}
