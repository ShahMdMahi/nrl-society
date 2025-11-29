import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  success,
  error,
  serverError,
  ErrorCodes,
  registerSchema,
  parseBody,
  logError,
  logInfo,
} from "@/lib/api";
import {
  checkRateLimitKV,
  getClientIP,
  RateLimitPresets,
} from "@/lib/security";
import { eq, or } from "drizzle-orm";

const REQUEST_ID_PREFIX = "register";

export async function POST(request: NextRequest) {
  const requestId = `${REQUEST_ID_PREFIX}_${Date.now().toString(36)}`;
  const clientIP = getClientIP(request);

  try {
    // Check rate limit by IP for registration
    const rateLimitKey = `register:${clientIP}`;
    const rateLimit = await checkRateLimitKV(
      rateLimitKey,
      RateLimitPresets.register
    );

    if (!rateLimit.allowed) {
      logInfo(requestId, "register_rate_limited", {
        ip: clientIP,
        retryAfter: rateLimit.retryAfter,
      });

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: `Too many registration attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 60) / 60)} minutes.`,
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60),
          },
        }
      );
    }
    // Validate request body
    const parsed = await parseBody(request, registerSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { email, username, password, displayName } = parsed.data;
    const db = await getDB();

    // Check if email or username already exists
    const existingUser = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existingUser.length > 0) {
      const existing = existingUser[0];
      if (existing.email === email) {
        logInfo(requestId, "register_failed", {
          reason: "email_exists",
          email,
        });
        return error(
          ErrorCodes.EMAIL_EXISTS,
          "An account with this email already exists",
          409
        );
      }
      if (existing.username === username) {
        logInfo(requestId, "register_failed", {
          reason: "username_exists",
          username,
        });
        return error(
          ErrorCodes.USERNAME_EXISTS,
          "This username is already taken",
          409
        );
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        displayName,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
      });

    // Create session
    const sessionId = await createSession(newUser.id);

    logInfo(requestId, "register_success", {
      userId: newUser.id,
      ip: clientIP,
    });

    return success(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          displayName: newUser.displayName,
          avatarUrl: newUser.avatarUrl,
          isVerified: newUser.isVerified,
        },
        sessionId,
      },
      undefined,
      201
    );
  } catch (err) {
    logError(requestId, "register_error", err);
    return serverError("Failed to create account");
  }
}
