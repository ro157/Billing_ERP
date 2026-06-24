import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy HH:mm')
}

export function generateInvoiceNumber(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(5, '0')}`
}

export function calculateGST(
  amount: number,
  gstRate: number,
  gstType: 'CGST_SGST' | 'IGST' | 'EXEMPT'
) {
  if (gstType === 'EXEMPT') {
    return { cgst: 0, sgst: 0, igst: 0, total: 0 }
  }
  const totalGst = roundToTwo((amount * gstRate) / 100)
  if (gstType === 'IGST') {
    return { cgst: 0, sgst: 0, igst: totalGst, total: totalGst }
  }
  const cgst = roundToTwo(totalGst / 2)
  const sgst = roundToTwo(totalGst - cgst)
  return { cgst, sgst, igst: 0, total: totalGst }
}

/** Round to nearest rupee: .49 and below down, .50 and above up */
export function roundToNearestRupee(amount: number): number {
  return Math.round(amount)
}

export function computeRoundOff(amount: number): number {
  return roundToTwo(roundToNearestRupee(amount) - roundToTwo(amount))
}

export function calculateItemAmount(
  quantity: number,
  rate: number,
  discountPercent: number = 0
): number {
  const grossAmount = quantity * rate
  const discountAmount = (grossAmount * discountPercent) / 100
  return grossAmount - discountAmount
}

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export function hasPermission(permissions: string[], module: string, action: string): boolean {
  return permissions.includes(`${module}:${action}`)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, '')
}

/** Trim and collapse spaces for display/storage. */
export function formatCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Normalized key for duplicate category checks (case- and trailing-punctuation-insensitive). */
export function normalizeCategoryNameKey(name: string): string {
  return formatCategoryName(name)
    .replace(/^[\s.,;:!?\-_]+|[\s.,;:!?\-_]+$/g, '')
    .toLowerCase()
}

export function sortByNameCaseSensitive<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'case' }))
}

export const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 7.5, 12, 18, 28]

export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
]

export const PERMISSION_MODULES = [
  'dashboard',
  'inventory',
  'billing',
  'purchases',
  'customers',
  'vendors',
  'quotations',
  'purchase-orders',
  'delivery-challans',
  'returnable-challans',
  'reports',
  'staff',
  'roles',
  'settings',
]

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'print', 'export']
