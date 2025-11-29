import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { hashToken } from "@/lib/email";
import { hashPassword } from "@/lib/auth/password";
import { eq, and, gt, isNull } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== "string") {
      return errorResponse("Reset token is required", "VALIDATION_ERROR", 400);
    }

    if (!password || typeof password !== "string") {
      return errorResponse("New password is required", "VALIDATION_ERROR", 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return errorResponse(
        "Password must be at least 8 characters",
        "VALIDATION_ERROR",
        400
      );
    }

    const db = await getDB();

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token);

    // Find valid, unused token
    const [resetToken] = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetToken) {
      return errorResponse(
        "Invalid or expired reset link. Please request a new password reset.",
        "INVALID_TOKEN",
        400
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Update user's password
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // Optionally: Invalidate all other reset tokens for this user
    await db
      .update(passwordResetTokens)
      .set({
        usedAt: new Date(),
      })
      .where(
        and(
          eq(passwordResetTokens.userId, resetToken.userId),
          isNull(passwordResetTokens.usedAt)
        )
      );

    return successResponse({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(
      "An error occurred. Please try again.",
      "SERVER_ERROR",
      500
    );
  }
}

// GET endpoint to verify token validity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return errorResponse("Token is required", "VALIDATION_ERROR", 400);
    }

    const db = await getDB();
    const tokenHash = await hashToken(token);

    const [resetToken] = await db
      .select({
        id: passwordResetTokens.id,
        expiresAt: passwordResetTokens.expiresAt,
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetToken) {
      return errorResponse(
        "Invalid or expired reset link",
        "INVALID_TOKEN",
        400
      );
    }

    return successResponse({
      valid: true,
      expiresAt: resetToken.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Verify token error:", error);
    return errorResponse(
      "An error occurred. Please try again.",
      "SERVER_ERROR",
      500
    );
  }
}
