import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { purchaseSchema } from '@/lib/validations'
import { ensurePurchaseSchema, ensureDocumentTermsColumns } from '@/lib/ensure-purchase-schema'
import { computePurchaseItemTotals } from '@/lib/purchase-totals'
import { roundToTwo } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchases', 'view')
  if (error) return error

  const [rows] = await db.execute(
    `SELECT p.*,
      v.name as vendor_name,
      v.gstin as vendor_gstin,
      v.contact_person as vendor_contact_person,
      v.phone as vendor_phone,
      v.mobile as vendor_mobile,
      v.address as vendor_address,
      v.city as vendor_city
     FROM purchases p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     WHERE p.id = ? AND p.organization_id = ?`,
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

async function insertPurchaseItems(
  conn: Awaited<ReturnType<typeof db.getConnection>>,
  purchaseId: string,
  purchaseNo: string,
  itemsWithTotals: any[],
  gstType: string,
  organizationId: string
) {
  for (const item of itemsWithTotals) {
    await conn.execute(
      `INSERT INTO purchase_items (id, purchase_id, product_id, description, quantity, rate,
        discount, gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, gst_amount, amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), purchaseId, item.productId || null, item.description || null,
       item.quantity, item.rate, item.discount || 0, item.gstRate,
       gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
       gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
       gstType === 'IGST' ? item.gstRate : 0,
       item.cgst, item.sgst, item.igst, item.cgst + item.sgst + item.igst, item.total]
    )
    if (item.productId) {
      await conn.execute(
        'UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND organization_id = ?',
        [item.quantity, item.productId, organizationId]
      )
      const [[stockRow]] = await conn.execute(
        'SELECT current_stock FROM products WHERE id = ? AND organization_id = ?',
        [item.productId, organizationId]
      ) as any[][]
      await conn.execute(
        'INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_type, reference_id, note) VALUES (?,?,?,?,?,?,?,?)',
        [randomUUID(), item.productId, 'IN', item.quantity, stockRow.current_stock, 'PURCHASE', purchaseId, purchaseNo]
      )
    }
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchases', 'edit')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensurePurchaseSchema()
    await ensureDocumentTermsColumns()
    const body = await req.json()

    if (!body.items || !Array.isArray(body.items)) {
      const [rows] = await conn.execute(
        'SELECT * FROM purchases WHERE id = ? AND organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { status, paidAmount, paymentMode, notes } = body
      const paid = paidAmount !== undefined ? paidAmount : rows[0].paid_amount
      const balance = rows[0].total_amount - paid

      await conn.execute(
        'UPDATE purchases SET status=COALESCE(?,status), paid_amount=?, balance_amount=?, payment_mode=COALESCE(?,payment_mode), notes=COALESCE(?,notes) WHERE id=? AND organization_id = ?',
        [status || null, paid, balance, paymentMode || null, notes || null, params.id, organizationId]
      )
      const [updated] = await db.execute(
        'SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ? AND p.organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      return NextResponse.json(updated[0])
    }

    const data = purchaseSchema.parse(body)
    const gstType = data.gstType

    const [existingRows] = await conn.execute(
      'SELECT * FROM purchases WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const existing = existingRows[0]
    const purchaseNo = existing.purchase_no

    await conn.beginTransaction()

    const [oldItems] = await conn.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', [params.id]) as any[]
    for (const item of oldItems as any[]) {
      if (item.product_id) {
        await conn.execute(
          'UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND organization_id = ?',
          [item.quantity, item.product_id, organizationId]
        )
      }
    }
    await conn.execute('DELETE FROM stock_movements WHERE reference_type = ? AND reference_id = ?', ['PURCHASE', params.id])
    await conn.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [params.id])

    let subtotal = 0,
      totalDiscount = 0,
      totalCgst = 0,
      totalSgst = 0,
      totalIgst = 0,
      totalRoundOff = 0,
      grandTotal = 0

    const itemsWithTotals = data.items.map((item: any) => {
      const t = computePurchaseItemTotals(item, gstType)
      subtotal += item.quantity * item.rate
      totalDiscount += t.discAmt
      totalCgst += t.cgst
      totalSgst += t.sgst
      totalIgst += t.igst
      totalRoundOff += t.lineRoundOff
      grandTotal += t.total
      return { ...item, ...t }
    })

    const roundOff = roundToTwo(totalRoundOff)
    const finalTotal = roundToTwo(grandTotal)
    const paidAmount = data.paidAmount ?? Number(existing.paid_amount) ?? 0
    const balanceAmount = roundToTwo(finalTotal - paidAmount)
    const status =
      balanceAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : existing.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING'

    await conn.execute(
      `UPDATE purchases SET vendor_id=?, date=?, due_date=?, gst_type=?, bill_no=?, bill_date=?,
        subtotal=?, discount_amount=?, cgst_amount=?, sgst_amount=?, igst_amount=?, tax_amount=?, round_off=?, total_amount=?,
        paid_amount=?, balance_amount=?, payment_mode=?, notes=?, terms=?, status=?
       WHERE id=? AND organization_id = ?`,
      [data.vendorId, data.date, data.dueDate || null,
       gstType, data.billNo || null, data.billDate || null,
       subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalCgst + totalSgst + totalIgst, roundOff, finalTotal,
       paidAmount, balanceAmount, data.paymentMode || null, data.notes || null, data.terms || null, status,
       params.id, organizationId]
    )

    await insertPurchaseItems(conn, params.id, purchaseNo, itemsWithTotals, gstType, organizationId!)

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ? AND p.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    const message =
      process.env.NODE_ENV === 'development' && err?.sqlMessage
        ? err.sqlMessage
        : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    conn.release()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('purchases', 'delete')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const [existing] = await conn.execute(
      'SELECT id FROM purchases WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await conn.beginTransaction()
    const [items] = await conn.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', [params.id]) as any[]
    for (const item of items as any[]) {
      if (item.product_id) {
        await conn.execute(
          'UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND organization_id = ?',
          [item.quantity, item.product_id, organizationId]
        )
      }
    }
    await conn.execute('DELETE FROM stock_movements WHERE reference_type = ? AND reference_id = ?', ['PURCHASE', params.id])
    await conn.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [params.id])
    await conn.execute('DELETE FROM purchases WHERE id = ? AND organization_id = ?', [params.id, organizationId])
    await conn.commit()
    return NextResponse.json({ success: true })
  } catch {
    await conn.rollback()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
