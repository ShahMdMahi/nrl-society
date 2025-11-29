import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { success, error } from "@/lib/api/response";
import {
  sendEmail,
  generateToken,
  hashToken,
  getPasswordResetEmailHtml,
} from "@/lib/email";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const { email } = body;

    if (!email || typeof email !== "string") {
      return error("VALIDATION_ERROR", "Email is required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const db = await getDB();

    // Find user by email
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Check for recent reset requests (rate limiting - 1 per 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [recentToken] = await db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            gt(passwordResetTokens.createdAt, fiveMinutesAgo)
          )
        )
        .limit(1);

      if (recentToken) {
        // Don't reveal that a token was recently sent
        return success({
          message:
            "If an account exists with this email, you will receive a password reset link.",
        });
      }

      // Generate reset token
      const token = generateToken();
      const tokenHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      // Build reset URL
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        request.headers.get("origin") ||
        "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your NRL Society password",
          html: getPasswordResetEmailHtml(resetUrl, user.displayName),
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't fail the request if email fails - log it for monitoring
      }
    }

    // Always return success to prevent email enumeration
    return success({
      message:
        "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return error("SERVER_ERROR", "An error occurred. Please try again.", 500);
  }
}
