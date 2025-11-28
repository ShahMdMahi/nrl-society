import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  success,
  error,
  validationError,
  serverError,
  ErrorCodes,
  loginSchema,
  validateBody,
} from "@/lib/api";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const { data, errors: validationErrors } = await validateBody(
      request,
      loginSchema,
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
    }

    const { email, password } = data;

    const db = await getDB();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return error(
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password",
        401,
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return error(
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password",
        401,
      );
    }

    // Create session
    const sessionId = await createSession(user.id);

    return success({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
      sessionId, // Include for mobile apps to store
    });
  } catch (err) {
    console.error("Login error:", err);
    return serverError("Failed to log in");
  }
}
