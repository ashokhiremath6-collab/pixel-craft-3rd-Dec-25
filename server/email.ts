import nodemailer from "nodemailer";
import { Resend } from "resend";

const FROM_NAME = "PixelCraft Designer";

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

function getBaseUrl(req?: { protocol?: string; hostname?: string }): string {
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
}): Promise<void> {
  // 1. Try Resend first
  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
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
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
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

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const resetUrl = `${baseUrl || getBaseUrl()}/reset-password?token=${token}`;
  console.info(`[EMAIL] Password reset link for ${email}: ${resetUrl}`);

  await sendEmail({
    to: email,
    subject: "Reset your PixelCraft Designer password",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
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
    text: `Reset your PixelCraft Designer password\n\nClick the link below to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}

export async function sendInvitationEmail(
  email: string,
  invitedBy: string,
  orgName: string,
  role: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const inviteUrl = `${baseUrl || getBaseUrl()}/invite/${token}`;
  console.info(`[EMAIL] Invitation link for ${email}: ${inviteUrl}`);

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${orgName} on PixelCraft Designer`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">You're invited!</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 8px;">
            <strong>${invitedBy}</strong> has invited you to join <strong>${orgName}</strong> on PixelCraft Designer as a <strong>${role}</strong>.
          </p>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Click the button below to accept the invitation and set up your account. This link expires in 48 hours.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#0071e3;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Accept Invitation
          </a>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `You've been invited to join ${orgName} on PixelCraft Designer!\n\n${invitedBy} has invited you as a ${role}.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis link expires in 48 hours.`,
  });
}

export async function sendPaymentFailedEmail(
  email: string,
  orgName: string
): Promise<void> {
  console.info(`[EMAIL] Payment failed notification for ${email} (org: ${orgName})`);
  await sendEmail({
    to: email,
    subject: `Action required: Payment failed for ${orgName} on PixelCraft Designer`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Payment failed</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            We were unable to process your latest payment for <strong>${orgName}</strong>. Please update your payment method to avoid any interruption to your service.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    `,
    text: `Payment failed for ${orgName} on PixelCraft Designer.\n\nWe were unable to process your latest payment. Please update your payment method to avoid any interruption to your service.`,
  });
}

export async function sendSubscriptionCancelledEmail(
  email: string,
  orgName: string
): Promise<void> {
  console.info(`[EMAIL] Subscription cancelled notification for ${email} (org: ${orgName})`);
  await sendEmail({
    to: email,
    subject: `Your ${orgName} subscription has been cancelled`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Subscription cancelled</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Your subscription for <strong>${orgName}</strong> has been cancelled. Your workspace has been moved to the free trial plan. You can resubscribe at any time to restore full access.
          </p>
          <p style="color:#6e6e73;font-size:13px;margin:20px 0 0;">
            If you did not request this cancellation, please contact support immediately.
          </p>
        </div>
      </div>
    `,
    text: `Your ${orgName} subscription on PixelCraft Designer has been cancelled.\n\nYour workspace has been moved to the free trial plan. You can resubscribe at any time to restore full access.`,
  });
}

export async function sendPlanChangedEmail(
  email: string,
  orgName: string,
  previousPlan: string,
  newPlan: string
): Promise<void> {
  const planLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
  console.info(
    `[EMAIL] Plan change notification for ${email} (org: ${orgName}): ${previousPlan} -> ${newPlan}`
  );
  await sendEmail({
    to: email,
    subject: `Your ${orgName} plan has been updated on PixelCraft Designer`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
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
        </div>
      </div>
    `,
    text: `Your plan for ${orgName} on PixelCraft Designer has been updated.\n\nPrevious plan: ${planLabel(previousPlan)}\nNew plan: ${planLabel(newPlan)}\n\nIf you have questions, please contact support.`,
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
  logPrefix: string
): Promise<void> {
  const urgency = trialUrgencyPhrase(daysRemaining);
  console.info(
    `[EMAIL] ${logPrefix} for ${email} (org: ${orgName}): ${daysRemaining} day(s) remaining`
  );
  await sendEmail({
    to: email,
    subject: `Your ${orgName} trial ${urgency} — upgrade to keep access`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
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
        </div>
      </div>
    `,
    text: `Your ${orgName} trial on PixelCraft Designer ${urgency}.\n\nAfter it ends, your workspace will be restricted to read-only access until you upgrade. Log in to your workspace to upgrade your plan.\n\nIf you have questions, please contact support.`,
  });
}

/** Stripe-webhook-triggered trial expiry email (fired by customer.subscription.trial_will_end). */
export async function sendTrialExpiryEmail(
  email: string,
  orgName: string,
  daysRemaining: number
): Promise<void> {
  return sendTrialExpiryEmailCore(email, orgName, daysRemaining, "Trial expiry warning (Stripe webhook)");
}

/** Scheduled-job-triggered trial expiry warning email (fired by the daily expiry check job). */
export async function sendTrialExpiryWarningEmail(
  email: string,
  orgName: string,
  daysRemaining: number
): Promise<void> {
  return sendTrialExpiryEmailCore(email, orgName, daysRemaining, "Automated trial expiry warning");
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
    subject: "Verify your PixelCraft Designer account",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#f5f5f7;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#1d1d1f;margin:0;">PixelCraft Designer</h1>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="font-size:18px;font-weight:600;color:#1d1d1f;margin:0 0 12px;">Verify your email</h2>
          <p style="color:#3d3d3d;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Welcome to PixelCraft Designer! Click the button below to verify your email address and activate your account.
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
    text: `Welcome to PixelCraft Designer!\n\nVerify your email address by visiting:\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
  });
}
