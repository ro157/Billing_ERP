import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'
import { quotationSchema } from '@/lib/validations'
import { ensureQuotationSchema } from '@/lib/ensure-quotation-schema'
import { buildQuotationTotals, insertQuotationItems } from '@/lib/quotation-save'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('quotations', 'view')
  if (error) return error

  await ensureQuotationSchema()

  const [rows] = await db.execute(
    `SELECT q.*,
      c.name as customer_name,
      c.contact_person as customer_contact_person,
      c.phone as customer_phone,
      c.mobile as customer_mobile,
      c.gstin as customer_gstin,
      c.pan as customer_pan,
      c.billing_address as customer_address,
      c.billing_city as customer_city,
      c.billing_state as customer_state,
      c.billing_pincode as customer_pincode,
      c.shipping_address as customer_shipping_address,
      c.shipping_city as customer_shipping_city,
      c.shipping_state as customer_shipping_state
     FROM quotations q
     LEFT JOIN customers c ON q.customer_id = c.id
     WHERE q.id = ?`,
    [params.id]
  ) as any[]
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items] = await db.execute('SELECT * FROM quotation_items WHERE quotation_id = ?', [params.id]) as any[]
  return NextResponse.json({ ...rows[0], items })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('quotations', 'edit')
  if (error) return error

  const conn = await db.getConnection()
  try {
    await ensureQuotationSchema()
    const body = await req.json()

    if (!body.items || !Array.isArray(body.items)) {
      const [rows] = await conn.execute('SELECT * FROM quotations WHERE id = ?', [params.id]) as any[]
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { notes } = body
      await conn.execute(
        'UPDATE quotations SET notes = COALESCE(?, notes) WHERE id = ?',
        [notes || null, params.id]
      )
      const [updated] = await db.execute(
        'SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id WHERE q.id = ?',
        [params.id]
      ) as any[]
      return NextResponse.json(updated[0])
    }

    const data = quotationSchema.parse(body)
    const gstType = data.gstType || 'CGST_SGST'

    const [existingRows] = await conn.execute('SELECT * FROM quotations WHERE id = ?', [params.id]) as any[]
    if (!existingRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const existing = existingRows[0]
    await conn.beginTransaction()

    await conn.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [params.id])

    const totals = buildQuotationTotals(data.items, gstType)
    const partyDetailsJson = data.partyDetails ? JSON.stringify(data.partyDetails) : null

    await conn.execute(
      `UPDATE quotations SET customer_id=?, date=?, valid_until=?, gst_type=?, subtotal=?,
        discount_amount=?, tax_amount=?, round_off=?, total_amount=?, notes=?, terms=?, party_details=?
       WHERE id=?`,
      [
        data.customerId,
        data.date,
        data.validUntil || null,
        gstType,
        totals.subtotal,
        totals.totalDiscount,
        totals.taxAmount,
        totals.roundOff,
        totals.grandTotal,
        data.notes || null,
        data.terms || null,
        partyDetailsJson,
        params.id,
      ]
    )

    await insertQuotationItems(conn, params.id, totals.itemsWithTotals)
    await conn.commit()

    const [rows] = await db.execute(
      'SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id WHERE q.id = ?',
      [params.id]
    ) as any[]
    return NextResponse.json(rows[0])
  } catch (err: any) {
    await conn.rollback()
    if (err.name === 'ZodError') return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('PUT /api/quotations/[id]:', err?.code, err?.message ?? err)
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
  const { error } = await requirePermission('quotations', 'delete')
  if (error) return error
  await db.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [params.id])
  await db.execute('DELETE FROM quotations WHERE id = ?', [params.id])
  return NextResponse.json({ success: true })
}
