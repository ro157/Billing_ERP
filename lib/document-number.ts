import { getYearMonthPrefix } from '@/lib/org-id'

/** Module prefix + YYYYMM, e.g. PO202406 */
export function buildDocumentNumberPrefix(
  modulePrefix: string,
  date: Date | string
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${modulePrefix}${getYearMonthPrefix(d)}`
}

function parseDocumentSerial(
  documentNo: string,
  numberPrefix: string
): number | null {
  if (!documentNo.startsWith(numberPrefix)) return null
  const serialPart = documentNo.slice(numberPrefix.length)
  if (!/^\d+$/.test(serialPart)) return null
  return parseInt(serialPart, 10)
}

/** 1-based MySQL SUBSTRING start for the serial portion after numberPrefix */
export function documentSerialSubstringStart(numberPrefix: string): number {
  return numberPrefix.length + 1
}

/** Prefix + YYYYMM + serial, e.g. PO2024061 */
export function nextDocumentNumber(
  modulePrefix: string,
  documentDate: Date | string,
  lastDocumentNo: string | null | undefined
): string {
  const numberPrefix = buildDocumentNumberPrefix(modulePrefix, documentDate)
  let nextSerial = 1
  if (lastDocumentNo) {
    const serial = parseDocumentSerial(lastDocumentNo, numberPrefix)
    if (serial !== null) nextSerial = serial + 1
  }
  return `${numberPrefix}${nextSerial}`
}
