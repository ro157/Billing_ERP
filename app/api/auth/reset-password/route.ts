import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, OTP, and new password are required' }, { status: 400 });
    }

    // Find user with email
    let users: any[] = [];
    try {
      const [rows] = (await db.execute(
        'SELECT otp, otp_expiry FROM users WHERE email = ? LIMIT 1',
        [email]
      )) as any[];
      users = rows;
    } catch (dbError: any) {
      if (dbError?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json(
          { error: 'Database is missing otp columns. Run the OTP migration first.' },
          { status: 500 }
        );
      }
      throw dbError;
    }

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    // Verify OTP again
    if (user.otp !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    if (!user.otp_expiry || new Date(user.otp_expiry) < new Date()) {
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear OTP fields
    await db.execute(
      'UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?',
      [hashedPassword, email]
    );

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}