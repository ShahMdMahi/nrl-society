import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  validateApiSession,
  SessionUser,
} from "@/lib/auth/session";
import {
  unauthorized,
  serverError,
  rateLimitError,
  validationError,
} from "./response";
import { z } from "zod";

/**
 * Request context passed to route handlers
 */
export interface ApiContext {
  user: SessionUser;
  requestId: string;
}

/**
 * Optional auth context for public routes
 */
export interface OptionalApiContext {
  user: SessionUser | null;
  requestId: string;
}

/**
 * Route handler type with authentication
 */
type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: ApiContext,
  params?: T
) => Promise<NextResponse>;

/**
 * Route handler type with optional authentication
 */
type OptionalAuthHandler<T = unknown> = (
  request: NextRequest,
  context: OptionalApiContext,
  params?: T
) => Promise<NextResponse>;

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Structured logger for API routes
 */
export function logError(
  requestId: string,
  operation: string,
  error: unknown,
  meta?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      operation,
      error: errorMessage,
      stack: errorStack,
      ...meta,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Structured info logger
 */
export function logInfo(
  requestId: string,
  operation: string,
  meta?: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      level: "info",
      requestId,
      operation,
      ...meta,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Authenticate request from cookie or Authorization header
 */
async function authenticateRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  // Try cookie-based auth first (web)
  const user = await getCurrentUser();
  if (user) {
    return user;
  }

  // Try Authorization header (mobile apps)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const session = await validateApiSession(authHeader);
    if (session) {
      // Return minimal user info from session
      // Full user data should be fetched if needed
      return {
        id: session.userId,
        email: "",
        username: "",
        displayName: "",
        avatarUrl: null,
        isVerified: false,
      };
    }
  }

  return null;
}

/**
 * Higher-order function to wrap route handlers with authentication
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
): (
  request: NextRequest,
  context?: { params?: Promise<T> }
) => Promise<NextResponse> {
  return async (
    request: NextRequest,
    routeContext?: { params?: Promise<T> }
  ) => {
    const requestId = generateRequestId();

    try {
      const user = await authenticateRequest(request);

      if (!user) {
        return unauthorized();
      }

      const params = routeContext?.params
        ? await routeContext.params
        : undefined;
      return await handler(request, { user, requestId }, params);
    } catch (error) {
      logError(requestId, "unhandled_error", error);
      return serverError("An unexpected error occurred");
    }
  };
}

/**
 * Higher-order function for routes with optional authentication
 */
export function withOptionalAuth<T = unknown>(
  handler: OptionalAuthHandler<T>
): (
  request: NextRequest,
  context?: { params?: Promise<T> }
) => Promise<NextResponse> {
  return async (
    request: NextRequest,
    routeContext?: { params?: Promise<T> }
  ) => {
    const requestId = generateRequestId();

    try {
      const user = await authenticateRequest(request);
      const params = routeContext?.params
        ? await routeContext.params
        : undefined;
      return await handler(request, { user, requestId }, params);
    } catch (error) {
      logError(requestId, "unhandled_error", error);
      return serverError("An unexpected error occurred");
    }
  };
}

/**
 * Validate request body with schema
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<
  { success: true; data: T } | { success: false; error: NextResponse }
> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: validationError("Invalid input", error.issues),
      };
    }
    return {
      success: false,
      error: validationError("Invalid JSON body"),
    };
  }
}

/**
 * Validate query parameters with schema
 */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: validationError("Invalid parameters", error.issues),
      };
    }
    return {
      success: false,
      error: validationError("Invalid query parameters"),
    };
  }
}

/**
 * KV-based rate limiter for Cloudflare Workers
 * Uses CACHE_KV namespace for rate limiting data
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<boolean> {
  try {
    const { cacheGet, cacheSet } = await import("@/lib/cloudflare/kv");
    const now = Date.now();
    const rateLimitKey = `ratelimit:${key}`;

    const record = await cacheGet<RateLimitRecord>(rateLimitKey);

    if (!record || record.resetAt < now) {
      // Start a new window
      await cacheSet(
        rateLimitKey,
        { count: 1, resetAt: now + windowMs },
        Math.ceil(windowMs / 1000) + 60 // TTL slightly longer than window
      );
      return true;
    }

    if (record.count >= limit) {
      return false;
    }

    // Increment count
    await cacheSet(
      rateLimitKey,
      { count: record.count + 1, resetAt: record.resetAt },
      Math.ceil((record.resetAt - now) / 1000) + 60
    );
    return true;
  } catch (err) {
    // If KV fails, allow the request but log the error
    console.error("Rate limit check failed:", err);
    return true;
  }
}

/**
 * Rate limit middleware wrapper
 */
export function withRateLimit<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options: { limit?: number; windowMs?: number; keyPrefix?: string } = {}
): AuthenticatedHandler<T> {
  const { limit = 100, windowMs = 60000, keyPrefix = "api" } = options;

  return async (request, context, params) => {
    const key = `${keyPrefix}:${context.user.id}`;
    const allowed = await checkRateLimit(key, limit, windowMs);

    if (!allowed) {
      return rateLimitError();
    }

    return handler(request, context, params);
  };
}
