import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const staffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'STAFF']),
  branch: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  roleIds: z.array(z.string()).optional(),
})

export const roleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()),
})

const finiteNumber = (min: number, max?: number) =>
  z.preprocess((val) => {
    if (typeof val === 'number' && Number.isNaN(val)) return min
    return val
  }, max !== undefined ? z.number().min(min).max(max) : z.number().min(min))

const finiteIntMin0 = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number' && Number.isNaN(val)) return 0
  return val
}, z.number().int().min(0))

export const productSchema = z.object({
  name: z.string().min(2, 'Product name required').max(200),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  purchasePrice: finiteNumber(0),
  sellingPrice: finiteNumber(0),
  mrp: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined
      if (typeof val === 'number' && Number.isNaN(val)) return undefined
      return val
    },
    z.number().min(0).optional()
  ),
  gstRate: finiteNumber(0, 100),
  gstType: z.enum(['CGST_SGST', 'IGST', 'EXEMPT']).default('CGST_SGST'),
  openingStock: finiteIntMin0,
  lowStockAlert: finiteIntMin0,
  discount: z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) return null
        const n = typeof val === 'number' ? val : Number(val)
        return Number.isFinite(n) ? n : null
      },
      z.union([z.number().min(0).max(100), z.null()])
    )
    .optional(),
  isActive: z.boolean().default(true),
})

export const customerSchema = z.object({
  name: z.string().min(2, 'Name required').max(200),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN').optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN').optional().or(z.literal('')),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingPincode: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingPincode: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  openingBalance: z.number().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
})

export const vendorSchema = z.object({
  name: z.string().min(2, 'Name required').max(200),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN').optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  openingBalance: z.number().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
})

export const invoiceItemSchema = z.object({
  productId: z.string().min(1, 'Product required'),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  rate: z.number().positive('Rate must be positive'),
  discount: z.number().min(0).max(100).default(0),
  gstRate: z.number().min(0).max(100).default(0),
})

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional(),
  gstType: z.enum(['CGST_SGST', 'IGST', 'EXEMPT']).default('CGST_SGST'),
  placeOfSupply: z.string().optional(),
  paymentMode: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD', 'OTHER']).optional(),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  fromQuotationId: z.string().optional(),
  fromChallanId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
})

export const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  date: z.string().or(z.date()),
  expectedDate: z.string().or(z.date()).optional(),
  gstType: z.enum(['CGST_SGST', 'IGST', 'EXEMPT']).default('CGST_SGST'),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().positive(),
    rate: z.number().positive(),
    discount: z.number().min(0).max(100).default(0),
    gstRate: z.number().min(0).max(100).default(0),
  })).min(1),
})

export const purchaseSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional(),
  gstType: z.enum(['CGST_SGST', 'IGST', 'EXEMPT']).default('CGST_SGST'),
  billNo: z.string().optional(),
  billDate: z.string().or(z.date()).optional(),
  paymentMode: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD', 'OTHER']).optional(),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  fromPoId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
})

export const quotationSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  date: z.string().or(z.date()),
  validUntil: z.string().or(z.date()).optional(),
  gstType: z.enum(['CGST_SGST', 'IGST', 'EXEMPT']).default('CGST_SGST'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
})

export const challanSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  date: z.string().or(z.date()),
  vehicleNo: z.string().optional(),
  driverName: z.string().optional(),
  destination: z.string().optional(),
  eWayBillNo: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().positive(),
    rate: z.number().min(0).default(0),
    unit: z.string().optional(),
    gstRate: z.number().min(0).max(100).default(0),
  })).min(1),
})

export const returnableChallanSchema = challanSchema

export const businessSettingsSchema = z.object({
  companyName: z.string().min(2, 'Company name required'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  logo: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankBranch: z.string().optional(),
  invoicePrefix: z.string().default('VE'),
  quotationPrefix: z.string().default('QT'),
  purchaseOrderPrefix: z.string().default('PO'),
  challanPrefix: z.string().default('DC'),
  termsCondition: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type StaffInput = z.infer<typeof staffSchema>
export type RoleInput = z.infer<typeof roleSchema>
export type ProductInput = z.infer<typeof productSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type VendorInput = z.infer<typeof vendorSchema>
export type InvoiceInput = z.infer<typeof invoiceSchema>
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>
export type PurchaseInput = z.infer<typeof purchaseSchema>
export type QuotationInput = z.infer<typeof quotationSchema>
export type ChallanInput = z.infer<typeof challanSchema>
export type ReturnableChallanInput = z.infer<typeof returnableChallanSchema>
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>
