import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { success, error, withAuth, ApiContext } from "@/lib/api";
import {
  sendEmail,
  generateToken,
  hashToken,
  getWelcomeEmailHtml,
} from "@/lib/email";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "edge";

// POST /api/v1/auth/resend-verification - Resend verification email
async function handleResendVerification(
  request: NextRequest,
  { user }: ApiContext
) {
  try {
    const db = await getDB();

    // Check if already verified
    const [userData] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData) {
      return error("NOT_FOUND", "User not found", 404);
    }

    if (userData.emailVerified) {
      return error("ALREADY_VERIFIED", "Email is already verified", 400);
    }

    // Check for recent verification requests (rate limiting - 1 per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [recentToken] = await db
      .select({ id: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          gt(emailVerificationTokens.createdAt, fiveMinutesAgo)
        )
      )
      .limit(1);

    if (recentToken) {
      return error(
        "RATE_LIMITED",
        "Please wait 5 minutes before requesting another verification email.",
        429
      );
    }

    // Generate verification token
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Build verification URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    // Send verification email
    await sendEmail({
      to: userData.email,
      subject: "Verify your NRL Society email",
      html: getWelcomeEmailHtml(verifyUrl, userData.displayName),
    });

    return success({
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return error("SERVER_ERROR", "An error occurred. Please try again.", 500);
  }
}

export const POST = withAuth(handleResendVerification);
