import { NextResponse } from "next/server";

/**
 * Security headers configuration
 */
export const securityHeaders = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking
  "X-Frame-Options": "DENY",

  // XSS protection (legacy but still useful)
  "X-XSS-Protection": "1; mode=block",

  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions policy (restrict browser features)
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",

  // HSTS - enforce HTTPS (1 year)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
} as const;

/**
 * Content Security Policy directives
 */
export const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Next.js
  "style-src": ["'self'", "'unsafe-inline'"], // Needed for inline styles
  "img-src": ["'self'", "data:", "blob:", "https:"], // Allow images from HTTPS sources
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", "https:"], // API calls
  "frame-ancestors": ["'none'"], // Prevent embedding
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "upgrade-insecure-requests": [],
} as const;

/**
 * Build CSP header string
 */
export function buildCSP(
  directives: Record<string, readonly string[]> = cspDirectives
): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Apply standard security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CSP
  response.headers.set("Content-Security-Policy", buildCSP());

  return response;
}

/**
 * Create a new response with security headers
 */
export function withSecurityHeaders<T>(
  data: T,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(data, init);
  return applySecurityHeaders(response);
}

/**
 * Security headers for API responses (less restrictive CSP)
 */
export const apiSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/**
 * Apply security headers to API response
 */
export function applyApiSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(apiSecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
