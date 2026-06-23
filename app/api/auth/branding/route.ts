import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import db, { isDbConnectionError } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { ensureBusinessSettingsBankingColumns } from '@/lib/ensure-business-settings-schema'
import { normalizeSidebarColor, DEFAULT_SIDEBAR_COLOR } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureBusinessSettingsBankingColumns()
    const session = await getServerSession(authOptions)
    const organizationId = session?.user?.organizationId

    if (organizationId) {
      const [rows] = await db.execute(`
        SELECT company_name as companyName, logo, sidebar_color as sidebarColor
        FROM business_settings
        WHERE organization_id = ?
        LIMIT 1
      `, [organizationId]) as [{ companyName?: string; logo?: string | null; sidebarColor?: string | null }[], unknown]

      const row = rows[0]
      if (row) {
        return NextResponse.json({
          companyName: row.companyName || 'Viros GST Billing',
          logo: row.logo || null,
          sidebarColor: normalizeSidebarColor(row.sidebarColor),
        })
      }
    }

    const [rows] = await db.execute(`
      SELECT company_name as companyName, logo, sidebar_color as sidebarColor
      FROM business_settings
      LIMIT 1
    `) as [{ companyName?: string; logo?: string | null; sidebarColor?: string | null }[], unknown]

    const row = rows[0]

    return NextResponse.json({
      companyName: row?.companyName || 'Viros GST Billing',
      logo: row?.logo || null,
      sidebarColor: normalizeSidebarColor(row?.sidebarColor),
    })
  } catch (error) {
    if (isDbConnectionError(error)) {
      console.warn(
        'Database unavailable for branding; using defaults. Start XAMPP MySQL on port 3306.'
      )
    } else {
      console.error('Error fetching auth branding:', error)
    }
    return NextResponse.json({
      companyName: 'Viros GST Billing',
      logo: null,
      sidebarColor: DEFAULT_SIDEBAR_COLOR,
    })
  }
}
