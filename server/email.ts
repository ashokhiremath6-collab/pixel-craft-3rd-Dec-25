import nodemailer from "nodemailer";
import { Resend } from "resend";

const FROM_NAME = "Pixelcraft Designs";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// When using Resend without a verified custom domain, use their default onboarding sender.
// Once you verify your domain at resend.com/domains, set RESEND_FROM to your own address.
const FROM_ADDRESS =
  process.env.RESEND_FROM ||
  process.env.SMTP_FROM ||
  process.env.SMTP_USER ||
  "onboarding@resend.dev";

export function getBaseUrl(req?: { protocol?: string; hostname?: string }): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req?.protocol && req?.hostname) return `${req.protocol}://${req.hostname}`;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0]}`;
  return "http://localhost:5000";
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): Promise<void> {
  const senderName = opts.fromName || FROM_NAME;
  // 1. Try Resend first
  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: `${senderName} <${FROM_ADDRESS}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return;
  }

  // 2. Fall back to SMTP
  const smtp = createSmtpTransport();
  if (smtp) {
    await smtp.sendMail({
      from: `"${senderName}" <${FROM_ADDRESS}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return;
  }

  // 3. No email service configured — log to console only
  console.warn(
    "[EMAIL] No email service configured (set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS). " +
      "Email not sent to: " + opts.to
  );
}

/**
 * Builds the HTML footer block that appears at the bottom of transactional emails.
 * Includes a link to manage preferences in Settings and an optional one-click unsubscribe link.
 */
function buildEmailFooter(opts: {
  baseUrl: string;
  unsubscribeToken?: string;
  notificationType?: string;
  orgName?: string;
}): { html: string; text: string } {
  const settingsUrl = `${opts.baseUrl}/settings`;
  const orgLine = opts.orgName
    ? `You're receiving this because you're an admin of <strong>${opts.orgName}</strong> on Pixelcraft Designs.`
    : `You're receiving this as a member of your organisation on Pixelcraft Designs.`;
  const orgLineText = opts.orgName
    ? `You're receiving this because you're an admin of ${opts.orgName} on Pixelcraft Designs.`
    : `You're receiving this as a member of your organisation on Pixelcraft Designs.`;

  let unsubscribeLinkHtml = "";
  let unsubscribeLinkText = "";
  if (opts.unsubscribeToken && opts.notificationType) {
    const params = new URLSearchParams({ token: opts.unsubscribeToken, type: opts.notificationType });
    const unsubscribeUrl = `${opts.baseUrl}/api/user/unsubscribe?${params.toString()}`;
    unsubscribeLinkHtml = ` &middot; <a href="${unsubscribeUrl}" style="color:#6e6e73;text-decoration:underline;">Unsubscribe from this type</a>`;
    unsubscribeLinkText = `\nUnsubscribe from this notification type: ${unsubscribeUrl}`;
  }

  const html = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;text-align:center;">
      <p style="color:#6e6e73;font-size:12px;line-height:1.5;margin:0 0 6px;">${orgLine}</p>
      <p style="color:#6e6e73;font-size:12px;margin:0;">
        <a href="${settingsUrl}" style="color:#6e6e73;text-decoration:underline;">Manage notification preferences</a>${unsubscribeLinkHtml}
      </p>
    </div>
  `;

  const text = `\n---\n${orgLineText}\nManage notification preferences: ${settingsUrl}${unsubscribeLinkText}`;

  return { html, text };
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const resetUrl = `${baseUrl || getBaseUrl()}/reset-password?token=${token}`;
  console.info(`[EMAIL] Password reset link for ${email}: ${resetUrl}`);

  await sendEmail({
    to: email,
    subject: "Reset your Pixelcraft Designs password",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Reset your password</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            We received a request to reset the password for your account. Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Reset Password
          </a>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Reset your Pixelcraft Designs password\n\nClick the link below to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}

export async function sendInvitationEmail(
  email: string,
  invitedBy: string,
  orgName: string,
  role: string,
  token: string,
  baseUrl?: string,
  inviteMessage?: string,
  alreadyHasAccount?: boolean,
  rfqDocumentName?: string,
  rfqDocumentUrl?: string
): Promise<void> {
  const inviteUrl = `${baseUrl || getBaseUrl()}/invite/${token}`;
  console.info(`[EMAIL] Invitation link for ${email}: ${inviteUrl}`);

  const isVendor = role === 'vendor';
  const subjectLine = isVendor
    ? `Quote request from ${orgName}`
    : `You've been invited to join ${orgName} on Pixelcraft Designs`;

  const messageBlock = isVendor && inviteMessage
    ? `<div style="background:#f0f4ff;border-left:4px solid #0071e3;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;">
        <p style="color:#1d1d1f;font-size:14px;font-weight:600;margin:0 0 6px;">Quote request details</p>
        <p style="color:#3d3d3d;font-size:14px;line-height:1.6;margin:0;white-space:pre-line;">${inviteMessage}</p>
      </div>`
    : '';

  const documentBlock = isVendor && rfqDocumentUrl && rfqDocumentName
    ? `<div style="background:#f5f5f7;border-radius:8px;padding:12px 16px;margin:16px 0;display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">📎</span>
        <div style="flex:1;min-width:0;">
          <p style="color:#1d1d1f;font-size:13px;font-weight:600;margin:0 0 2px;">Instructions document attached</p>
          <p style="color:#6e6e73;font-size:12px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${rfqDocumentName}</p>
        </div>
        <a href="${rfqDocumentUrl}" style="flex-shrink:0;background:#0071e3;color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;text-decoration:none;">Download</a>
      </div>`
    : '';

  const bodyIntro = isVendor
    ? `<strong>${invitedBy}</strong> from <strong>${orgName}</strong> has sent you a quote request.`
    : `<strong>${invitedBy}</strong> has invited you to join <strong>${orgName}</strong> on Pixelcraft Designs as a <strong>${role}</strong>.`;

  const ctaLabel = isVendor
    ? (alreadyHasAccount ? 'Enter Portal' : 'Set Up Your Vendor Account')
    : 'Accept Invitation';

  const actionLine = isVendor
    ? (alreadyHasAccount
        ? 'Click the button below to enter your vendor portal and submit your quote. This link expires in 48 hours.'
        : 'Click the button below to set up your account and submit your quote. This link expires in 48 hours.')
    : 'Click the button below to get started. This link expires in 48 hours.';

  // For vendor emails, show the studio name prominently; for internal invites, show Pixelcraft Designs branding
  const emailHeader = isVendor
    ? `<h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0 0 4px;">${orgName}</h1>
       <p style="font-size:12px;color:#6e6e73;margin:0;">Powered by Pixelcraft Designs</p>`
    : `<h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>`;

  await sendEmail({
    to: email,
    subject: subjectLine,
    fromName: isVendor ? orgName : FROM_NAME,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          ${emailHeader}
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">${isVendor ? 'Quote request' : "You're invited!"}</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 8px;">${bodyIntro}</p>
          ${messageBlock}
          ${documentBlock}
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            ${actionLine}
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            ${ctaLabel}
          </a>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you weren't expecting this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: isVendor
      ? `Quote request from ${orgName}\n\n${invitedBy} from ${orgName} has sent you a quote request.${inviteMessage ? `\n\nDetails:\n${inviteMessage}` : ''}\n\n${alreadyHasAccount ? 'Enter your portal here' : 'Set up your account here'}:\n${inviteUrl}\n\nThis link expires in 48 hours.`
      : `You've been invited to join ${orgName} on Pixelcraft Designs!\n\n${invitedBy} has invited you as a ${role}.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis link expires in 48 hours.`,
  });
}

export async function sendPaymentFailedEmail(
  email: string,
  orgName: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  console.info(`[EMAIL] Payment failed notification for ${email} (org: ${orgName})`);
  const base = opts?.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "paymentFailures",
    orgName,
  });
  await sendEmail({
    to: email,
    subject: `Action required: Payment failed for ${orgName} on Pixelcraft Designs`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Payment failed</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            We were unable to process your latest payment for <strong>${orgName}</strong>. Please update your payment method to avoid any interruption to your service.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you believe this is an error, please contact support.
          </p>
          ${footer.html}
        </div>
      </div>
    `,
    text: `Payment failed for ${orgName} on Pixelcraft Designs.\n\nWe were unable to process your latest payment. Please update your payment method to avoid any interruption to your service.${footer.text}`,
  });
}

export async function sendSubscriptionCancelledEmail(
  email: string,
  orgName: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  console.info(`[EMAIL] Subscription cancelled notification for ${email} (org: ${orgName})`);
  const base = opts?.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "planChanges",
    orgName,
  });
  await sendEmail({
    to: email,
    subject: `Your ${orgName} subscription has been cancelled`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Subscription cancelled</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Your subscription for <strong>${orgName}</strong> has been cancelled. Your workspace has been moved to the free trial plan. You can resubscribe at any time to restore full access.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you did not request this cancellation, please contact support immediately.
          </p>
          ${footer.html}
        </div>
      </div>
    `,
    text: `Your ${orgName} subscription on Pixelcraft Designs has been cancelled.\n\nYour workspace has been moved to the free trial plan. You can resubscribe at any time to restore full access.${footer.text}`,
  });
}

export async function sendPlanChangedEmail(
  email: string,
  orgName: string,
  previousPlan: string,
  newPlan: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  const planLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
  console.info(
    `[EMAIL] Plan change notification for ${email} (org: ${orgName}): ${previousPlan} -> ${newPlan}`
  );
  const base = opts?.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "planChanges",
    orgName,
  });
  await sendEmail({
    to: email,
    subject: `Your ${orgName} plan has been updated on Pixelcraft Designs`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Your plan has been updated</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 16px;">
            The subscription plan for <strong>${orgName}</strong> has been changed by a system administrator.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
            <tr>
              <td style="padding:10px 12px;background:#f5f5f7;border-radius:8px 8px 0 0;color:#6e6e73;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Previous plan</td>
              <td style="padding:10px 12px;background:#f5f5f7;border-radius:8px 8px 0 0;color:#1d1d1f;font-size:15px;font-weight:600;text-align:right;">${planLabel(previousPlan)}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#e8f4fd;border-radius:0 0 8px 8px;color:#6e6e73;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">New plan</td>
              <td style="padding:10px 12px;background:#e8f4fd;border-radius:0 0 8px 8px;color:#0071e3;font-size:15px;font-weight:600;text-align:right;">${planLabel(newPlan)}</td>
            </tr>
          </table>
          <p style="color:#6e6e73;font-size:13px;margin:0;">
            If you have questions about this change, please contact support.
          </p>
          ${footer.html}
        </div>
      </div>
    `,
    text: `Your plan for ${orgName} on Pixelcraft Designs has been updated.\n\nPrevious plan: ${planLabel(previousPlan)}\nNew plan: ${planLabel(newPlan)}\n\nIf you have questions, please contact support.${footer.text}`,
  });
}

function trialUrgencyPhrase(daysRemaining: number): string {
  if (daysRemaining === 0) return "expires today";
  if (daysRemaining === 1) return "expires tomorrow";
  return `expires in ${daysRemaining} days`;
}

async function sendTrialExpiryEmailCore(
  email: string,
  orgName: string,
  daysRemaining: number,
  logPrefix: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  const urgency = trialUrgencyPhrase(daysRemaining);
  console.info(
    `[EMAIL] ${logPrefix} for ${email} (org: ${orgName}): ${daysRemaining} day(s) remaining`
  );
  const base = opts?.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "trialExpiry",
    orgName,
  });
  await sendEmail({
    to: email,
    subject: `Your ${orgName} trial ${urgency} — upgrade to keep access`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Your trial ${urgency}</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 16px;">
            The free trial for <strong>${orgName}</strong> ${urgency}. After it ends, your workspace will be restricted to read-only access until you upgrade.
          </p>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Upgrade now to keep full access to all your projects, team members, and files.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:0;">
            Log in to your workspace to upgrade your plan. If you have questions, please contact support.
          </p>
          ${footer.html}
        </div>
      </div>
    `,
    text: `Your ${orgName} trial on Pixelcraft Designs ${urgency}.\n\nAfter it ends, your workspace will be restricted to read-only access until you upgrade. Log in to your workspace to upgrade your plan.\n\nIf you have questions, please contact support.${footer.text}`,
  });
}

/** Stripe-webhook-triggered trial expiry email (fired by customer.subscription.trial_will_end). */
export async function sendTrialExpiryEmail(
  email: string,
  orgName: string,
  daysRemaining: number,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  return sendTrialExpiryEmailCore(email, orgName, daysRemaining, "Trial expiry warning (Stripe webhook)", opts);
}

/** Scheduled-job-triggered trial expiry warning email (fired by the daily expiry check job). */
export async function sendTrialExpiryWarningEmail(
  email: string,
  orgName: string,
  daysRemaining: number,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  return sendTrialExpiryEmailCore(email, orgName, daysRemaining, "Automated trial expiry warning", opts);
}

export async function sendInvitationAcceptedEmail(
  email: string,
  inviteeName: string,
  orgName: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  console.info(`[EMAIL] Invitation accepted notification for ${email} (invitee: ${inviteeName})`);
  const base = opts?.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "invitationAccepted",
  });

  await sendEmail({
    to: email,
    subject: `${inviteeName} has accepted your invitation to ${orgName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Invitation accepted</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            <strong>${inviteeName}</strong> has accepted your invitation and joined <strong>${orgName}</strong> on Pixelcraft Designs.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:0;">
            You can view your team members in the Settings page of your workspace.
          </p>
          ${footer.html}
        </div>
      </div>
    `,
    text: `${inviteeName} has accepted your invitation to ${orgName} on Pixelcraft Designs.\n\nYou can view your team members in the Settings page of your workspace.${footer.text}`,
  });
}

export async function sendProjectUpdateEmail(
  email: string,
  projectName: string,
  updatedBy: string,
  opts?: { unsubscribeToken?: string; baseUrl?: string }
): Promise<void> {
  console.info(`[EMAIL] Project update notification for ${email} (project: ${projectName})`);
  const base = opts?.baseUrl || getBaseUrl();
  const projectsUrl = `${base}/`;
  const footer = buildEmailFooter({
    baseUrl: base,
    unsubscribeToken: opts?.unsubscribeToken,
    notificationType: "projectUpdates",
  });

  await sendEmail({
    to: email,
    subject: `Project update: ${projectName} on Pixelcraft Designs`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">A project has been updated</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            <strong>${projectName}</strong> has been updated by <strong>${updatedBy}</strong>. Log in to your workspace to view the latest changes.
          </p>
          <a href="${projectsUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            View Project
          </a>
          ${footer.html}
        </div>
      </div>
    `,
    text: `${projectName} has been updated by ${updatedBy} on Pixelcraft Designs.\n\nLog in to view the latest changes: ${projectsUrl}${footer.text}`,
  });
}

export async function sendPaymentRequestEmail(opts: {
  toEmails: string[];
  clientName: string;
  vendorName: string;
  amount: number;
  description: string;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branch?: string | null;
  projectName?: string | null;
  tokenLink: string;
  studioName?: string | null;
}): Promise<void> {
  const amountFormatted = `₹${opts.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hasBankDetails = opts.bankName || opts.accountNumber || opts.ifscCode;

  const bankBlock = hasBankDetails ? `
    <div style="background:#f5f5f7;border-radius:10px;padding:16px 20px;margin:16px 0;">
      <p style="font-size:13px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px;">Bank Details</p>
      ${opts.accountHolderName ? `<p style="margin:0 0 5px;font-size:14px;color:#1d1d1f;"><strong>Account Holder:</strong> ${opts.accountHolderName}</p>` : ""}
      ${opts.bankName ? `<p style="margin:0 0 5px;font-size:14px;color:#1d1d1f;"><strong>Bank:</strong> ${opts.bankName}</p>` : ""}
      ${opts.accountNumber ? `<p style="margin:0 0 5px;font-size:14px;color:#1d1d1f;"><strong>Account No:</strong> ${opts.accountNumber}</p>` : ""}
      ${opts.ifscCode ? `<p style="margin:0 0 5px;font-size:14px;color:#1d1d1f;"><strong>IFSC:</strong> ${opts.ifscCode}</p>` : ""}
      ${opts.branch ? `<p style="margin:0;font-size:14px;color:#1d1d1f;"><strong>Branch:</strong> ${opts.branch}</p>` : ""}
    </div>` : "";

  const bankTextBlock = hasBankDetails ? `\nBank Details:\n${opts.accountHolderName ? `Account Holder: ${opts.accountHolderName}\n` : ""}${opts.bankName ? `Bank: ${opts.bankName}\n` : ""}${opts.accountNumber ? `Account No: ${opts.accountNumber}\n` : ""}${opts.ifscCode ? `IFSC: ${opts.ifscCode}\n` : ""}${opts.branch ? `Branch: ${opts.branch}\n` : ""}` : "";

  const studioLabel = opts.studioName || "Your Designer";
  const subject = `Payment request from ${studioLabel} — ${amountFormatted}`;

  for (const to of opts.toEmails) {
    console.info(`[EMAIL] Payment request to ${to}: ${amountFormatted} for ${opts.vendorName}`);
    await sendEmail({
      to,
      subject,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:20px;font-weight:700;color:#1d1d1f;margin:0;letter-spacing:-0.3px;">${studioLabel}</h1>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;">
            <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Payment request</h2>
            <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Hi ${opts.clientName}, your designer has raised a payment request. Please transfer the amount below to your vendor${opts.projectName ? ` for project <strong>${opts.projectName}</strong>` : ""}.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
              <tr>
                <td style="padding:10px 12px;background:#f5f5f7;border-radius:8px 8px 0 0;color:#6e6e73;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Vendor</td>
                <td style="padding:10px 12px;background:#f5f5f7;border-radius:8px 8px 0 0;color:#1d1d1f;font-size:15px;font-weight:600;text-align:right;">${opts.vendorName}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;background:#e8f4fd;border-radius:0;color:#6e6e73;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Amount</td>
                <td style="padding:10px 12px;background:#e8f4fd;border-radius:0;color:#0071e3;font-size:18px;font-weight:700;text-align:right;">${amountFormatted}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:10px 12px;background:#f5f5f7;border-radius:0 0 8px 8px;color:#3d3d3d;font-size:14px;">${opts.description}</td>
              </tr>
            </table>
            ${bankBlock}
            <p style="color:#3d3d3d;font-size:14px;line-height:1.6;margin:0 0 20px;">
              After completing the payment, click the button below to confirm your transfer — no login required.
            </p>
            <a href="${opts.tokenLink}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View &amp; Confirm Payment
            </a>
            <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
              If you have any questions, please contact your designer directly.
            </p>
          </div>
        </div>
      `,
      text: `Payment request from ${studioLabel}\n\nHi ${opts.clientName},\n\nYour designer has raised a payment request.\n\nVendor: ${opts.vendorName}\nAmount: ${amountFormatted}\nDetails: ${opts.description}${opts.projectName ? `\nProject: ${opts.projectName}` : ""}${bankTextBlock}\n\nAfter making the payment, confirm it here (no login required):\n${opts.tokenLink}`,
    });
  }
}

export async function sendDrawingForReviewEmail(opts: {
  toEmails: string[];
  drawingTitle: string;
  revisionLetter: string;
  projectName: string;
  portalUrl: string;
  baseUrl?: string;
}): Promise<void> {
  const base = opts.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({ baseUrl: base });
  for (const to of opts.toEmails) {
    console.info(`[EMAIL] Drawing for_review to ${to}: ${opts.drawingTitle} Rev ${opts.revisionLetter}`);
    await sendEmail({
      to,
      subject: `New drawing ready for your review — ${opts.drawingTitle}, ${opts.projectName}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;">
            <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Drawing ready for review</h2>
            <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 8px;">
              A new revision of <strong>${opts.drawingTitle}</strong> (Revision ${opts.revisionLetter}) is ready for your review on <strong>${opts.projectName}</strong>.
            </p>
            <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Please log in to your client portal to view and approve the drawing.
            </p>
            <a href="${opts.portalUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View Drawing
            </a>
            ${footer.html}
          </div>
        </div>
      `,
      text: `New drawing ready for review\n\n${opts.drawingTitle} (Revision ${opts.revisionLetter}) is ready for your review on ${opts.projectName}.\n\nLog in to view and approve it here:\n${opts.portalUrl}${footer.text}`,
    });
  }
}

export async function sendNewRenderEmail(opts: {
  toEmails: string[];
  projectName: string;
  portalUrl: string;
  baseUrl?: string;
}): Promise<void> {
  const base = opts.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({ baseUrl: base });
  for (const to of opts.toEmails) {
    console.info(`[EMAIL] New render notification to ${to}: project ${opts.projectName}`);
    await sendEmail({
      to,
      subject: `New render available — ${opts.projectName}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;">
            <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">New render available</h2>
            <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
              A new render has been added to your project <strong>${opts.projectName}</strong>. Log in to your client portal to view it.
            </p>
            <a href="${opts.portalUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View Renders
            </a>
            ${footer.html}
          </div>
        </div>
      `,
      text: `New render available for ${opts.projectName}.\n\nA new render has been added to your project. View it here:\n${opts.portalUrl}${footer.text}`,
    });
  }
}

export async function sendDrawingApprovedEmail(opts: {
  toEmails: string[];
  drawingTitle: string;
  clientName: string;
  projectName: string;
  adminUrl: string;
  baseUrl?: string;
}): Promise<void> {
  const base = opts.baseUrl || getBaseUrl();
  const footer = buildEmailFooter({ baseUrl: base });
  for (const to of opts.toEmails) {
    console.info(`[EMAIL] Drawing approved notification to ${to}: ${opts.drawingTitle} by ${opts.clientName}`);
    await sendEmail({
      to,
      subject: `${opts.clientName} approved ${opts.drawingTitle}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;">
            <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Drawing approved</h2>
            <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
              <strong>${opts.clientName}</strong> has approved <strong>${opts.drawingTitle}</strong> on project <strong>${opts.projectName}</strong>.
            </p>
            <a href="${opts.adminUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View in Workspace
            </a>
            ${footer.html}
          </div>
        </div>
      `,
      text: `Drawing approved\n\n${opts.clientName} has approved ${opts.drawingTitle} on project ${opts.projectName}.\n\nView it here:\n${opts.adminUrl}${footer.text}`,
    });
  }
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const verifyUrl = `${baseUrl || getBaseUrl()}/api/auth/verify-email/${token}`;
  console.info(`[EMAIL] Verification link for ${email}: ${verifyUrl}`);

  await sendEmail({
    to: email,
    subject: "Verify your Pixelcraft Designs account",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">Pixelcraft Designs</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Verify your email</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Welcome to Pixelcraft Designs! Click the button below to verify your email address and activate your account.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Verify Email
          </a>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Welcome to Pixelcraft Designs!\n\nVerify your email address by visiting:\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
  });
}
