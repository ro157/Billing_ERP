import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD?.replace(/\s+/g, '').trim()

  if (!host || !port || !user || !password) return null
  return { host, port, user, password }
}

export function getAppBranding() {
  return {
    appName: process.env.APP_NAME?.trim() || 'Viros GST Billing',
    appUrl:
      process.env.APP_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      'http://localhost:3000',
  }
}

export async function sendMail(options: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getSmtpConfig()
  if (!config) {
    return { ok: false, error: 'SMTP is not configured' }
  }

  const { appName } = getAppBranding()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  })

  try {
    await transporter.sendMail({
      from: `"${appName}" <${config.user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    return { ok: true }
  } catch (err) {
    console.error('SMTP send error:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    }
  }
}
