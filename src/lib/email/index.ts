import { Resend } from "resend";

// Initialize Resend client
// Note: RESEND_API_KEY should be set in wrangler.json or as a secret
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const resend = getResendClient();

  // Use your verified domain in production, or onboarding@resend.dev for testing
  const fromEmail =
    process.env.EMAIL_FROM || "NRL Society <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for plain text version
  });

  if (error) {
    console.error("Failed to send email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

// Generate a secure random token
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Hash a token for secure storage
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Email templates
export function getPasswordResetEmailHtml(
  resetUrl: string,
  displayName: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">NRL Society</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Reset your password</h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${displayName},
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                We received a request to reset your password. Click the button below to choose a new password. This link will expire in 1 hour.
              </p>
              
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #18181b; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #71717a;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #a1a1aa; word-break: break-all;">
                ${resetUrl}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 40px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                © ${new Date().getFullYear()} NRL Society. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailHtml(
  verifyUrl: string,
  displayName: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to NRL Society</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">NRL Society</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Welcome to NRL Society! 🎉</h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${displayName},
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Thanks for joining our community! Please verify your email address to get started.
              </p>
              
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #18181b; text-decoration: none; border-radius: 8px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #71717a;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 40px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                © ${new Date().getFullYear()} NRL Society. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
