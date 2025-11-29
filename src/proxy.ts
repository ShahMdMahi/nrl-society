import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security headers applied to all responses
 */
const securityHeaders = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // XSS protection
  "X-XSS-Protection": "1; mode=block",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Permissions policy
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // HSTS - enforce HTTPS (1 year)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

/**
 * Content Security Policy for the app
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
  "style-src 'self' 'unsafe-inline'", // Required for inline styles
  "img-src 'self' data: blob: https:", // Allow images from HTTPS sources
  "font-src 'self' data:",
  "connect-src 'self' https:", // API calls
  "frame-ancestors 'none'", // Prevent embedding
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

/**
 * Next.js 16+ Proxy (formerly Middleware)
 * Runs before requests are completed to modify responses
 */
export function proxy(request: NextRequest) {
  // Get the response
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CSP (not too strict for development)
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Content-Security-Policy", cspDirectives.join("; "));
  }

  return response;
}

/**
 * Match all routes except static files and api routes that handle their own headers
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
