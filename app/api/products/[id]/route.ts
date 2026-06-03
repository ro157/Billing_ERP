import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { ensureProductsDiscountColumn } from '@/lib/ensure-product-schema'
import { productSchema } from '@/lib/validations'

function optionalToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('inventory', 'view')
  if (error) return error

  const [rows] = await db.execute(
    `SELECT p.*, c.name as category_name, b.name as brand_name, u.name as unit_name, u.short_name as unit_short_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN brands b ON p.brand_id = b.id
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.id = ?`,
    [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('inventory', 'edit')
  if (error) return error
  try {
    const body = await req.json()
    const data = productSchema.parse(body)
    await ensureProductsDiscountColumn()

    await db.execute(
      `UPDATE products SET
        name = ?, sku = ?, barcode = ?, hsn_code = ?, sac_code = ?, description = ?,
        category_id = ?, brand_id = ?, unit_id = ?,
        purchase_price = ?, selling_price = ?, mrp = ?,
        gst_rate = ?, gst_type = ?, low_stock_alert = ?, discount = ?, is_active = ?
       WHERE id = ?`,
      [
        data.name,
        optionalToNull(data.sku),
        optionalToNull(data.barcode),
        optionalToNull(data.hsnCode),
        optionalToNull(data.sacCode),
        optionalToNull(data.description),
        optionalToNull(data.categoryId),
        optionalToNull(data.brandId),
        optionalToNull(data.unitId),
        data.purchasePrice,
        data.sellingPrice,
        data.mrp ?? null,
        data.gstRate,
        data.gstType,
        data.lowStockAlert,
        data.discount ?? null,
        data.isActive ? 1 : 0,
        params.id,
      ]
    )

    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name, b.name as brand_name, u.name as unit_name, u.short_name as unit_short_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN units u ON p.unit_id = u.id WHERE p.id = ?`,
      [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: unknown) {
    const e = err as { name?: string; code?: string; message?: string; errors?: unknown }
    if (e?.name === 'ZodError') return NextResponse.json({ error: e.errors }, { status: 400 })
    if (e?.code === 'ER_DUP_ENTRY') {
      const msg = String(e.message ?? '')
      if (/sku/i.test(msg)) return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
      if (/barcode/i.test(msg)) return NextResponse.json({ error: 'Barcode already exists' }, { status: 400 })
      return NextResponse.json({ error: 'SKU or barcode already exists' }, { status: 400 })
    }
    console.error('PUT /api/products/[id]:', e?.code, e?.message ?? err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('inventory', 'delete')
  if (error) return error
  await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
