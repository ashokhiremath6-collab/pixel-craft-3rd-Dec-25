import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@pixelcraftdesigner.com";

function getBaseUrl(req?: { protocol?: string; hostname?: string }): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req?.protocol && req?.hostname) return `${req.protocol}://${req.hostname}`;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0]}`;
  return "http://localhost:5000";
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const transporter = createTransport();
  if (!transporter) {
    console.warn(
      "[EMAIL] SMTP not configured — skipping password reset email. " +
        "Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email sending."
    );
    console.info(`[EMAIL] Password reset token for ${email}: ${token}`);
    return;
  }

  const resetUrl = `${baseUrl || getBaseUrl()}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM,
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

export async function sendVerificationEmail(
  email: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const transporter = createTransport();
  if (!transporter) {
    console.warn(
      "[EMAIL] SMTP not configured — skipping verification email. " +
        "Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email sending."
    );
    console.info(`[EMAIL] Verification token for ${email}: ${token}`);
    return;
  }

  const verifyUrl = `${baseUrl || getBaseUrl()}/api/auth/verify-email/${token}`;

  await transporter.sendMail({
    from: FROM,
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
