import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const [rows] = await db.execute(`
      SELECT company_name as companyName, logo
      FROM business_settings
      LIMIT 1
    `) as [{ companyName?: string; logo?: string | null }[], unknown]

    const row = rows[0]

    return NextResponse.json({
      companyName: row?.companyName || 'Viros GST Billing',
      logo: row?.logo || null,
    })
  } catch (error) {
    console.error('Error fetching auth branding:', error)
    return NextResponse.json({
      companyName: 'Viros GST Billing',
      logo: null,
    })
  }
}
