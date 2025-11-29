import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  success,
  error,
  serverError,
  ErrorCodes,
  loginSchema,
  parseBody,
  logError,
  logInfo,
} from "@/lib/api";
import {
  checkRateLimitKV,
  resetRateLimit,
  getClientIP,
  getAuthRateLimitKey,
  RateLimitPresets,
} from "@/lib/security";
import { eq } from "drizzle-orm";

const REQUEST_ID_PREFIX = "login";

export async function POST(request: NextRequest) {
  const requestId = `${REQUEST_ID_PREFIX}_${Date.now().toString(36)}`;
  const clientIP = getClientIP(request);

  try {
    // Validate request body
    const parsed = await parseBody(request, loginSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { email, password } = parsed.data;

    // Check rate limit by IP + email combination
    const rateLimitKey = getAuthRateLimitKey(clientIP, email);
    const rateLimit = await checkRateLimitKV(
      rateLimitKey,
      RateLimitPresets.login
    );

    if (!rateLimit.allowed) {
      logInfo(requestId, "login_rate_limited", {
        ip: clientIP,
        email,
        retryAfter: rateLimit.retryAfter,
      });

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: `Too many login attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 60) / 60)} minutes.`,
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    const db = await getDB();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      logInfo(requestId, "login_failed", { reason: "user_not_found", email });
      return error(
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password",
        401
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      logInfo(requestId, "login_failed", {
        reason: "invalid_password",
        userId: user.id,
      });
      return error(
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password",
        401
      );
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Reset rate limit on successful login
    await resetRateLimit(rateLimitKey);

    logInfo(requestId, "login_success", { userId: user.id, ip: clientIP });

    return success({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
      sessionId,
    });
  } catch (err) {
    logError(requestId, "login_error", err);
    return serverError("Failed to log in");
  }
}
