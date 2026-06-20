import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ message: 'Invalid email or password.' })
    }

    const [users] = (await db.execute('SELECT id, password FROM users WHERE email = ? LIMIT 1', [
      String(email).trim().toLowerCase(),
    ])) as [{ id: string; password: string }[], unknown]

    const user = users[0]
    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password.' })
    }

    const valid = await bcrypt.compare(String(password), String(user.password))
    if (!valid) {
      return NextResponse.json({ message: 'Invalid email or password.' })
    }

    const [pendingRows] = (await db.execute(
      `SELECT o.name FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = ? AND o.status = 'PENDING'
       LIMIT 1`,
      [user.id]
    )) as [{ name: string }[], unknown]

    if (pendingRows[0]) {
      return NextResponse.json({
        message:
          'Your organisation is pending approval. Please wait for Super Admin to approve your registration.',
      })
    }

    return NextResponse.json({ message: 'Invalid email or password.' })
  } catch {
    return NextResponse.json({ message: 'Invalid email or password.' })
  }
}
