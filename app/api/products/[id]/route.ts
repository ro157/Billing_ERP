import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

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
    const updates: string[] = []
    const values: any[] = []
    const fields: Record<string, string> = {
      name: 'name', sku: 'sku', barcode: 'barcode', hsnCode: 'hsn_code', sacCode: 'sac_code',
      description: 'description', categoryId: 'category_id', brandId: 'brand_id', unitId: 'unit_id',
      purchasePrice: 'purchase_price', sellingPrice: 'selling_price', mrp: 'mrp',
      gstRate: 'gst_rate', gstType: 'gst_type', lowStockAlert: 'low_stock_alert',
    }
    for (const [key, col] of Object.entries(fields)) {
      if (key in body) { updates.push(`${col} = ?`); values.push(body[key] ?? null) }
    }
    if ('isActive' in body) { updates.push('is_active = ?'); values.push(body.isActive ? 1 : 0) }
    if (updates.length > 0) {
      await db.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, [...values, params.id])
    }
    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name, b.name as brand_name, u.name as unit_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN units u ON p.unit_id = u.id WHERE p.id = ?`,
      [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('inventory', 'delete')
  if (error) return error
  await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
