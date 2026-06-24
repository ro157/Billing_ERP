import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { purchaseOrderSchema } from '@/lib/validations'
import { ensureDocumentTermsColumns } from '@/lib/ensure-purchase-schema'
import { randomUUID } from 'crypto'

function computeItemTotals(item: { quantity: number; rate: number; discount?: number; gstRate: number }, gstType = 'CGST_SGST') {
  const taxable = item.quantity * item.rate * (1 - (item.discount || 0) / 100)
  let cgst = 0
  let sgst = 0
  let igst = 0
  if (gstType === 'CGST_SGST') {
    cgst = taxable * item.gstRate / 200
    sgst = cgst
  } else if (gstType === 'IGST') {
    igst = taxable * item.gstRate / 100
  }
  const total = taxable + cgst + sgst + igst
  const discAmt = item.quantity * item.rate - taxable
  return { taxable, cgst, sgst, igst, total, discAmt }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'view')
  if (error) return error

  const [rows] = await db.execute(
    `SELECT po.*,
      v.name as vendor_name,
      v.gstin as vendor_gstin,
      v.contact_person as vendor_contact_person,
      v.phone as vendor_phone,
      v.mobile as vendor_mobile,
      v.address as vendor_address,
      v.city as vendor_city
     FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE po.id = ? AND po.organization_id = ?`,
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'edit')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensureDocumentTermsColumns()
    const body = await req.json()

    if (!body.items || !Array.isArray(body.items)) {
      const [existing] = await conn.execute(
        'SELECT id FROM purchase_orders WHERE id = ? AND organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { status, notes } = body
      await conn.execute(
        'UPDATE purchase_orders SET status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=? AND organization_id = ?',
        [status || null, notes || null, params.id, organizationId]
      )
      const [rows] = await db.execute(
        'SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ? AND po.organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      return NextResponse.json(rows[0])
    }

    const data = purchaseOrderSchema.parse(body)
    const gstType = data.gstType || 'CGST_SGST'

    const [existingRows] = await conn.execute(
      'SELECT * FROM purchase_orders WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await conn.beginTransaction()

    let subtotal = 0
    let totalDiscount = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let grandTotal = 0
    const itemsWithTotals = data.items.map((item) => {
      const t = computeItemTotals(item, gstType)
      subtotal += item.quantity * item.rate
      totalDiscount += t.discAmt
      totalCgst += t.cgst
      totalSgst += t.sgst
      totalIgst += t.igst
      grandTotal += t.total
      return { ...item, ...t }
    })

    await conn.execute(
      `UPDATE purchase_orders SET vendor_id=?, date=?, expected_date=?, subtotal=?,
        discount_amount=?, tax_amount=?, total_amount=?, notes=?, terms=? WHERE id=? AND organization_id = ?`,
      [
        data.vendorId,
        data.date,
        data.expectedDate || null,
        subtotal,
        totalDiscount,
        totalCgst + totalSgst + totalIgst,
        grandTotal,
        data.notes || null,
        data.terms || null,
        params.id,
        organizationId,
      ]
    )

    await conn.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [params.id])

    for (const item of itemsWithTotals) {
      await conn.execute(
        `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, received_qty,
          rate, discount, gst_rate, gst_amount, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          randomUUID(),
          params.id,
          item.productId || null,
          item.description || null,
          item.quantity,
          0,
          item.rate,
          item.discount || 0,
          item.gstRate,
          item.cgst + item.sgst + item.igst,
          item.total,
        ]
      )
    }

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ? AND po.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchase-orders', 'delete')
  if (error) return error

  const [existing] = await db.execute(
    'SELECT id FROM purchase_orders WHERE id = ? AND organization_id = ?',
    [params.id, organizationId]
  ) as any[]
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [params.id])
  await db.execute('DELETE FROM purchase_orders WHERE id = ? AND organization_id = ?', [params.id, organizationId])
  return NextResponse.json({ success: true })
}
