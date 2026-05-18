import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.toString().trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Check if user exists
    const [users] = await db.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    ) as any[];

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate 5-digit OTP
    const otp = crypto.randomInt(10000, 99999).toString();

    // Set expiry to 10 minutes from now
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update user with OTP and expiry
    try {
      await db.execute(
        'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?',
        [otp, otpExpiry, email]
      );
    } catch (dbError: any) {
      if (dbError?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json(
          { error: 'Database is missing otp columns. Run the OTP migration first.' },
          { status: 500 }
        );
      }
      throw dbError;
    }

    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER?.trim();
    // Gmail app passwords are often pasted with spaces.
    const smtpPassword = process.env.SMTP_PASSWORD?.replace(/\s+/g, '').trim();

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.' },
        { status: 500 }
      );
    }

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: smtpUser,
      to: email,
      subject: 'Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Your OTP for password reset is:</p>
          <div style="font-size: 24px; font-weight: bold; color: #333; text-align: center; padding: 20px; border: 2px solid #ddd; border-radius: 5px;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await transporter.verify();
      await transporter.sendMail(mailOptions);
    } catch (mailError: any) {
      console.error('SMTP send error:', mailError);
      return NextResponse.json(
        {
          error:
            'Unable to send OTP email. Check SMTP credentials (for Gmail use 16-char App Password) and try again.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}