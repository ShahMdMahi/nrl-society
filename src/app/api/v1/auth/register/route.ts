import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  success,
  error,
  validationError,
  serverError,
  ErrorCodes,
  registerSchema,
  validateBody,
} from "@/lib/api";
import { eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const { data, errors: validationErrors } = await validateBody(
      request,
      registerSchema
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
    }

    const { email, username, password, displayName } = data;

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
        return error(
          ErrorCodes.EMAIL_EXISTS,
          "An account with this email already exists",
          409
        );
      }
      if (existing.username === username) {
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
        sessionId, // Include for mobile apps to store
      },
      undefined,
      201
    );
  } catch (err) {
    console.error("Registration error:", err);
    return serverError("Failed to create account");
  }
}
