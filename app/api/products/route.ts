import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureProductsDiscountColumn } from '@/lib/ensure-product-schema'
import { productSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('inventory', 'view')
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const categoryId = searchParams.get('categoryId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const conditions: string[] = ['p.is_active = 1']
  const params: any[] = []
  if (search) { conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.hsn_code LIKE ?)'); const s = `%${search}%`; params.push(s, s, s) }
  if (categoryId) { conditions.push('p.category_id = ?'); params.push(categoryId) }
  const where = 'WHERE ' + conditions.join(' AND ')

  const query = `SELECT p.*, c.name as category_name, b.name as brand_name, u.name as unit_name, u.short_name as unit_short_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN brands b ON p.brand_id = b.id
     LEFT JOIN units u ON p.unit_id = u.id
     ${where} ORDER BY p.name ASC LIMIT ? OFFSET ?`
  const [rows] = await db.execute(query, [...params, limit, offset]) as any[]

  const countQuery = `SELECT COUNT(*) as total FROM products p ${where}`
  const [countRows] = await db.execute(countQuery, params) as any[]

  return NextResponse.json({ products: rows, total: countRows[0].total, page, limit })
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('inventory', 'create')
  if (error) return error
  try {
    const body = await req.json()
    const data = productSchema.parse(body)
    await ensureProductsDiscountColumn()
    const id = randomUUID()
    await db.execute(
      `INSERT INTO products (id, name, sku, barcode, hsn_code, sac_code, description,
        category_id, brand_id, unit_id, purchase_price, selling_price, mrp,
        gst_rate, gst_type, opening_stock, current_stock, low_stock_alert, discount, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.sku || null, data.barcode || null, data.hsnCode || null, data.sacCode || null,
       data.description || null, data.categoryId || null, data.brandId || null, data.unitId || null,
       data.purchasePrice, data.sellingPrice, data.mrp ?? null, data.gstRate, data.gstType,
       data.openingStock, data.openingStock, data.lowStockAlert, data.discount ?? null, data.isActive ? 1 : 0]
    )
    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name, b.name as brand_name, u.name as unit_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.id = ?`,
      [id]
    ) as any[]
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    if (err?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'SKU or barcode already exists' }, { status: 400 })
    console.error('POST /api/products:', err?.code, err?.message ?? err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
