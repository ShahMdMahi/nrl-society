import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { success, error } from "@/lib/api/response";
import { hashToken } from "@/lib/email";
import { eq, and, gt, isNull } from "drizzle-orm";

export const runtime = "edge";

// GET /api/v1/auth/verify-email?token=xxx - Verify email address
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return error("VALIDATION_ERROR", "Verification token is required", 400);
    }

    const db = await getDB();

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token);

    // Find valid, unused token
    const [verificationToken] = await db
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId,
        expiresAt: emailVerificationTokens.expiresAt,
      })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          gt(emailVerificationTokens.expiresAt, new Date()),
          isNull(emailVerificationTokens.verifiedAt)
        )
      )
      .limit(1);

    if (!verificationToken) {
      return error(
        "INVALID_TOKEN",
        "Invalid or expired verification link. Please request a new one.",
        400
      );
    }

    // Mark email as verified
    await db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, verificationToken.userId));

    // Mark token as used
    await db
      .update(emailVerificationTokens)
      .set({
        verifiedAt: new Date(),
      })
      .where(eq(emailVerificationTokens.id, verificationToken.id));

    return success({
      message: "Email verified successfully. You can now use all features.",
    });
  } catch (err) {
    console.error("Verify email error:", err);
    return error("SERVER_ERROR", "An error occurred. Please try again.", 500);
  }
}
