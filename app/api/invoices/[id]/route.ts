import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { invoiceSchema } from '@/lib/validations'
import { ensureInvoiceSchema } from '@/lib/ensure-invoice-schema'
import { calculateGST, roundToNearestRupee, roundToTwo } from '@/lib/utils'
import { randomUUID } from 'crypto'

function computeItemTotals(item: any, gstType: string) {
  // UI uses flat ₹ discount applied after GST on the line total
  const taxable = roundToTwo((Number(item.quantity) || 0) * (Number(item.rate) || 0))
  const gst = calculateGST(taxable, Number(item.gstRate) || 0, (gstType as any) || 'CGST_SGST')
  const totalWithGst = roundToTwo(taxable + gst.total)
  const discAmt = roundToTwo(
    Math.min(Math.max(0, Number(item.discount) || 0), totalWithGst)
  )
  const total = roundToTwo(totalWithGst - discAmt)
  return { taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, total, discAmt }
}

async function insertInvoiceItems(
  conn: Awaited<ReturnType<typeof db.getConnection>>,
  invoiceId: string,
  invoiceNo: string,
  itemsWithTotals: any[],
  gstType: string,
  organizationId: string
) {
  for (const item of itemsWithTotals) {
    await conn.execute(
      `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, rate,
        discount, gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, gst_amount, amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), invoiceId, item.productId || null, item.description || null,
       item.quantity, item.rate, item.discount || 0, item.gstRate,
       gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
       gstType === 'CGST_SGST' ? item.gstRate / 2 : 0,
       gstType === 'IGST' ? item.gstRate : 0,
       item.cgst, item.sgst, item.igst, item.cgst + item.sgst + item.igst, item.total]
    )
    if (item.productId) {
      await conn.execute(
        'UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND organization_id = ?',
        [item.quantity, item.productId, organizationId]
      )
      const [[stockRow]] = await conn.execute(
        'SELECT current_stock FROM products WHERE id = ? AND organization_id = ?',
        [item.productId, organizationId]
      ) as any[][]
      await conn.execute(
        'INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_type, reference_id, note) VALUES (?,?,?,?,?,?,?,?)',
        [randomUUID(), item.productId, 'OUT', item.quantity, stockRow.current_stock, 'INVOICE', invoiceId, invoiceNo]
      )
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('billing', 'view')
  if (error) return error

  await ensureInvoiceSchema()

  const [rows] = await db.execute(
    `SELECT i.*,
       c.name as customer_name,
       c.gstin as customer_gstin,
       c.contact_person as customer_contact_person,
       c.phone as customer_phone,
       c.mobile as customer_mobile,
       c.pan as customer_pan,
       c.billing_address,
       c.billing_city,
       c.billing_state,
       c.billing_pincode,
       c.shipping_address as customer_shipping_address,
       c.shipping_city as customer_shipping_city
     FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ? AND i.organization_id = ?`,
    [params.id, organizationId]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute(
    'SELECT ii.*, p.sku FROM invoice_items ii LEFT JOIN products p ON ii.product_id = p.id WHERE ii.invoice_id = ?',
    [params.id]
  ) as any[]
  const [payments] = await db.execute(
    'SELECT * FROM payments WHERE reference_id = ? AND type = ? ORDER BY payment_date DESC',
    [params.id, 'INVOICE']
  ) as any[]

  return NextResponse.json({ ...rows[0], items, payments })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('billing', 'edit')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensureInvoiceSchema()
    const body = await req.json()

    if (!body.items || !Array.isArray(body.items)) {
      const [rows] = await conn.execute(
        'SELECT * FROM invoices WHERE id = ? AND organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { paidAmount, paymentMode, notes } = body
      const paid = paidAmount !== undefined ? paidAmount : rows[0].paid_amount
      const balance = rows[0].total_amount - paid

      await conn.execute(
        `UPDATE invoices SET paid_amount = ?, balance_amount = ?,
          payment_mode = COALESCE(?, payment_mode), notes = COALESCE(?, notes)
         WHERE id = ? AND organization_id = ?`,
        [paid, balance, paymentMode || null, notes || null, params.id, organizationId]
      )

      const [updated] = await db.execute(
        'SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ? AND i.organization_id = ?',
        [params.id, organizationId]
      ) as any[]
      return NextResponse.json(updated[0])
    }

    const data = invoiceSchema.parse(body)
    const gstType = data.gstType

    const [existingRows] = await conn.execute(
      'SELECT * FROM invoices WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const existing = existingRows[0]
    const invoiceNo = existing.invoice_no

    await conn.beginTransaction()

    const [oldItems] = await conn.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [params.id]) as any[]
    for (const item of oldItems as any[]) {
      if (item.product_id) {
        await conn.execute(
          'UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND organization_id = ?',
          [item.quantity, item.product_id, organizationId]
        )
      }
    }
    await conn.execute('DELETE FROM stock_movements WHERE reference_type = ? AND reference_id = ?', ['INVOICE', params.id])
    await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [params.id])

    let subtotal = 0, totalDiscount = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal = 0
    const itemsWithTotals = data.items.map((item: any) => {
      const t = computeItemTotals(item, gstType)
      subtotal += t.taxable
      totalDiscount += t.discAmt
      totalCgst += t.cgst
      totalSgst += t.sgst
      totalIgst += t.igst
      grandTotal += t.total
      return { ...item, ...t }
    })

    const taxAmount = roundToTwo(totalCgst + totalSgst + totalIgst)
    const totalAmount = roundToNearestRupee(roundToTwo(grandTotal))

    const paidAmount = data.paidAmount ?? Number(existing.paid_amount) ?? 0
    const balanceAmount = roundToTwo(totalAmount - paidAmount)

    const partyDetailsJson = data.partyDetails ? JSON.stringify(data.partyDetails) : null

    await conn.execute(
      `UPDATE invoices SET customer_id=?, date=?, due_date=?, gst_type=?, place_of_supply=?,
        subtotal=?, discount_amount=?, cgst_amount=?, sgst_amount=?, igst_amount=?, tax_amount=?, total_amount=?,
        paid_amount=?, balance_amount=?, payment_mode=?, notes=?, terms=?, party_details=?
       WHERE id=? AND organization_id = ?`,
      [data.customerId, data.date, data.dueDate || null, gstType, data.placeOfSupply || null,
       roundToTwo(subtotal), roundToTwo(totalDiscount), roundToTwo(totalCgst), roundToTwo(totalSgst), roundToTwo(totalIgst), taxAmount, totalAmount,
       paidAmount, balanceAmount, data.paymentMode || null, data.notes || null, data.terms || null, partyDetailsJson,
       params.id, organizationId]
    )

    await insertInvoiceItems(conn, params.id, invoiceNo, itemsWithTotals, gstType, organizationId!)

    await conn.commit()
    const [rows] = await db.execute(
      'SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ? AND i.organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, organizationId } = await requirePermission('billing', 'delete')
  if (error) return error

  const conn = await db.getConnection()
  try {
    const [existing] = await conn.execute(
      'SELECT id FROM invoices WHERE id = ? AND organization_id = ?',
      [params.id, organizationId]
    ) as any[]
    if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await conn.beginTransaction()
    const [items] = await conn.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [params.id]) as any[]
    for (const item of items as any[]) {
      if (item.product_id) {
        await conn.execute(
          'UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND organization_id = ?',
          [item.quantity, item.product_id, organizationId]
        )
      }
    }
    await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [params.id])
    await conn.execute('DELETE FROM payments WHERE reference_id = ? AND type = ?', [params.id, 'INVOICE'])
    await conn.execute('DELETE FROM invoices WHERE id = ? AND organization_id = ?', [params.id, organizationId])
    await conn.commit()
    return NextResponse.json({ success: true })
  } catch {
    await conn.rollback()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    conn.release()
  }
}
