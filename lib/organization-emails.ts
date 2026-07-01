import { getAppBranding, sendMail } from '@/lib/mail'
import { ORG_APPROVAL_NOTICE } from '@/lib/registration-messages'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailLayout(content: string): string {
  const { appName } = getAppBranding()
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">${escapeHtml(appName)}</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 28px 24px;">
        ${content}
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(appName)}. All rights reserved.
      </p>
    </div>
  `
}

export async function sendOrganizationRegistrationEmail(params: {
  to: string
  ownerName: string
  organizationName: string
}) {
  const { appName, appUrl } = getAppBranding()
  const loginUrl = `${appUrl}/login`
  const ownerName = escapeHtml(params.ownerName)
  const organizationName = escapeHtml(params.organizationName)

  const html = emailLayout(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Congratulations, ${ownerName}!</h2>
    <p style="line-height: 1.65; color: #475569; margin: 0 0 16px;">
      Thank you for registering <strong>${organizationName}</strong> on ${escapeHtml(appName)}.
      Your organisation account has been created successfully.
    </p>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
      <p style="margin: 0; line-height: 1.65; color: #92400e; font-size: 14px;">
        ${escapeHtml(ORG_APPROVAL_NOTICE)}
      </p>
    </div>
    <p style="line-height: 1.65; color: #475569; margin: 0 0 20px;">
      We will send you another email once your organisation is approved.
      After approval, you can sign in and start managing invoices, GST billing, and your team.
    </p>
    <p style="margin: 0; text-align: center;">
      <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Go to Sign In
      </a>
    </p>
  `)

  return sendMail({
    to: params.to,
    subject: `Welcome to ${appName} — Registration Received`,
    html,
  })
}

export async function sendOrganizationApprovedEmail(params: {
  to: string
  ownerName: string
  organizationName: string
}) {
  const { appName, appUrl } = getAppBranding()
  const loginUrl = `${appUrl}/login`
  const ownerName = escapeHtml(params.ownerName)
  const organizationName = escapeHtml(params.organizationName)

  const html = emailLayout(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Great news, ${ownerName}!</h2>
    <p style="line-height: 1.65; color: #475569; margin: 0 0 16px;">
      Your organisation <strong>${organizationName}</strong> has been approved on ${escapeHtml(appName)}.
    </p>
    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
      <p style="margin: 0; line-height: 1.65; color: #065f46; font-size: 14px;">
        You now have full access to your account. Sign in with your registered email and password to get started.
      </p>
    </div>
    <p style="line-height: 1.65; color: #475569; margin: 0 0 20px;">
      Start creating invoices, managing customers, and handling GST billing for your business right away.
    </p>
    <p style="margin: 0; text-align: center;">
      <a href="${loginUrl}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Sign In Now
      </a>
    </p>
  `)

  return sendMail({
    to: params.to,
    subject: `Your organisation is approved — ${appName}`,
    html,
  })
}
