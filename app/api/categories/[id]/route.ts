import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { requirePermission } from '@/lib/api-auth'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requirePermission('inventory', 'delete')
  if (error) return error
  try {
    await db.execute('UPDATE products SET category_id = NULL WHERE category_id = ?', [params.id])
    await db.execute('DELETE FROM categories WHERE id = ?', [params.id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
