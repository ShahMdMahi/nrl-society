import { kvGet, kvSet } from "@/lib/cloudflare/kv";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxAttempts: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Lockout duration in seconds after exceeding limit */
  lockoutSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitData {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowSeconds: 60,
  lockoutSeconds: 900, // 15 minutes
};

/**
 * Check rate limit for a given key using Cloudflare KV
 * Suitable for authentication endpoints (login, register, password reset)
 */
export async function checkRateLimitKV(
  key: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const { maxAttempts, windowSeconds, lockoutSeconds } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const now = Date.now();
  const kvKey = `ratelimit:${key}`;

  // Get existing rate limit data
  const data = await kvGet<RateLimitData>(kvKey, { type: "json" });

  // Check if currently locked out
  if (data?.lockedUntil && data.lockedUntil > now) {
    const retryAfter = Math.ceil((data.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.lockedUntil,
      retryAfter,
    };
  }

  // Check if within window
  const windowStart = now - windowSeconds * 1000;

  if (!data || data.firstAttempt < windowStart) {
    // New window
    const newData: RateLimitData = {
      count: 1,
      firstAttempt: now,
    };
    await kvSet(kvKey, newData, { expirationTtl: windowSeconds * 2 });

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: now + windowSeconds * 1000,
    };
  }

  // Within existing window
  const newCount = data.count + 1;

  if (newCount > maxAttempts) {
    // Exceeded limit - apply lockout
    const lockedUntil = lockoutSeconds
      ? now + lockoutSeconds * 1000
      : undefined;
    const lockoutData: RateLimitData = {
      ...data,
      count: newCount,
      lockedUntil,
    };

    const ttl = lockoutSeconds || windowSeconds;
    await kvSet(kvKey, lockoutData, { expirationTtl: ttl });

    return {
      allowed: false,
      remaining: 0,
      resetAt: lockedUntil || data.firstAttempt + windowSeconds * 1000,
      retryAfter: lockoutSeconds,
    };
  }

  // Increment counter
  const updatedData: RateLimitData = {
    ...data,
    count: newCount,
  };
  await kvSet(kvKey, updatedData, { expirationTtl: windowSeconds * 2 });

  return {
    allowed: true,
    remaining: maxAttempts - newCount,
    resetAt: data.firstAttempt + windowSeconds * 1000,
  };
}

/**
 * Reset rate limit for a key (e.g., after successful login)
 */
export async function resetRateLimit(key: string): Promise<void> {
  const { env } = await import("@/lib/cloudflare/kv").then((m) =>
    import("@opennextjs/cloudflare").then((c) => c.getCloudflareContext())
  );
  const appEnv = env as { SESSIONS_KV: KVNamespace };
  await appEnv.SESSIONS_KV.delete(`ratelimit:${key}`);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Cloudflare provides the real IP in CF-Connecting-IP
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For
  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Fallback to X-Real-IP
  const realIP = request.headers.get("X-Real-IP");
  if (realIP) return realIP;

  return "unknown";
}

/**
 * Generate rate limit key for authentication endpoints
 */
export function getAuthRateLimitKey(ip: string, identifier?: string): string {
  if (identifier) {
    // Rate limit by both IP and identifier (email/username)
    return `auth:${ip}:${identifier.toLowerCase()}`;
  }
  return `auth:${ip}`;
}

// Pre-configured rate limiters for different use cases
export const RateLimitPresets = {
  /** Strict limit for login attempts: 5 attempts per 15 min, 30 min lockout */
  login: {
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
    lockoutSeconds: 1800, // 30 minutes
  },
  /** Limit for registration: 3 attempts per hour */
  register: {
    maxAttempts: 3,
    windowSeconds: 3600, // 1 hour
    lockoutSeconds: 3600, // 1 hour
  },
  /** Limit for password reset: 3 attempts per hour */
  passwordReset: {
    maxAttempts: 3,
    windowSeconds: 3600,
    lockoutSeconds: 3600,
  },
  /** General API limit: 100 requests per minute */
  api: {
    maxAttempts: 100,
    windowSeconds: 60,
    lockoutSeconds: 60,
  },
} as const;
