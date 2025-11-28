import { NextResponse } from "next/server";

/**
 * Standard API response format for mobile app compatibility
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    cursor?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a success response
 */
export function success<T>(
  data: T,
  meta?: ApiSuccessResponse["meta"],
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(meta && { meta }),
    },
    { status }
  );
}

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorObj: ApiErrorResponse["error"] = { code, message };
  if (details !== undefined) {
    errorObj.details = details;
  }
  return NextResponse.json(
    {
      success: false as const,
      error: errorObj,
    },
    { status }
  );
}

// Common error codes and messages
export const ErrorCodes = {
  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  USERNAME_EXISTS: "USERNAME_EXISTS",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  FORBIDDEN: "FORBIDDEN",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  UPLOAD_ERROR: "UPLOAD_ERROR",
} as const;

// Pre-built error responses
export const unauthorized = () =>
  error(ErrorCodes.UNAUTHORIZED, "Authentication required", 401);

export const forbidden = () =>
  error(ErrorCodes.FORBIDDEN, "You don't have permission to access this resource", 403);

export const notFound = (resource = "Resource") =>
  error(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);

export const validationError = (message: string, details?: unknown) =>
  error(ErrorCodes.VALIDATION_ERROR, message, 400, details);

export const serverError = (message = "An unexpected error occurred") =>
  error(ErrorCodes.INTERNAL_ERROR, message, 500);

export const rateLimitError = () =>
  error(ErrorCodes.RATE_LIMIT_EXCEEDED, "Too many requests, please try again later", 429);
