import type jsPDF from 'jspdf'

export interface DocumentHeaderSettings {
  companyName: string
  pan?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logo?: string | null
}

function splitCompanyName(name: string): string[] {
  const n = name.trim() || 'Company Name'
  const itSolutions = n.match(/^(.+?\s+IT)\s+(Solutions\s+.+)$/i)
  if (itSolutions) return [itSolutions[1], itSolutions[2]]
  const pvtLtd = n.match(/^(.+?)\s+(Private\s+Limited|Pvt\.?\s+Ltd\.?)$/i)
  if (pvtLtd && pvtLtd[1].split(/\s+/).length >= 2) return [pvtLtd[1], pvtLtd[2]]
  const words = n.split(/\s+/)
  if (words.length <= 5) return [n]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

function locationLine(city?: string | null, state?: string | null, pincode?: string | null): string {
  const parts = [city, state].filter(Boolean).join(', ')
  if (parts && pincode) return `${parts} - ${pincode}`
  return parts || pincode || ''
}

function addLogo(doc: jsPDF, logo: string | null | undefined, x: number, y: number, size: number) {
  if (!logo?.startsWith('data:image')) return
  const fmt = logo.includes('image/png') ? 'PNG' : 'JPEG'
  try {
    doc.addImage(logo, fmt, x, y, size, size)
  } catch {
    // skip invalid logo
  }
}

/**
 * Draws the company letterhead outside the document body box.
 * Returns the Y position where the main bordered content box should start.
 */
export function drawDocumentHeader(
  doc: jsPDF,
  settings: DocumentHeaderSettings,
  margin: number,
  pageW: number
): number {
  const contentW = pageW - margin * 2
  let y = margin

  addLogo(doc, settings.logo, margin, y, 24)

  const nameX = margin + 28
  const nameLines = splitCompanyName(settings.companyName)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  nameLines.forEach((line, i) => {
    doc.text(line, nameX, y + 6 + i * 4.8)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  let addrY = y + 6 + nameLines.length * 4.8 + 1.5
  const addressLines = (settings.address || '').split('\n').filter(Boolean)
  addressLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentW * 0.48)
    doc.text(wrapped, nameX, addrY)
    addrY += wrapped.length * 3.4
  })
  const loc = locationLine(settings.city, settings.state, settings.pincode)
  if (loc) {
    doc.text(loc, nameX, addrY)
    addrY += 3.4
  }

  const rightX = pageW - margin
  let contactY = y + 6
  const contacts = [
    ['Phone', settings.phone],
    ['Email', settings.email],
    ['Website', settings.website],
    ['PAN', settings.pan],
  ] as const

  doc.setFontSize(7.5)
  contacts.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold')
    const labelText = `${label} : `
    const valueText = val || '-'
    const labelW = doc.getTextWidth(labelText)
    const valueW = doc.getTextWidth(valueText)
    const totalW = labelW + valueW
    doc.text(labelText, rightX - totalW, contactY)
    doc.setFont('helvetica', 'normal')
    doc.text(valueText, rightX - valueW, contactY)
    contactY += 4.2
  })

  const headerBottom = Math.max(addrY, contactY) + 4

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(margin, headerBottom, pageW - margin, headerBottom)

  return headerBottom + 4
}
