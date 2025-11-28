import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import {
  success,
  unauthorized,
  validationError,
  serverError,
  searchSchema,
  validateParams,
} from "@/lib/api";
import { like, or, sql } from "drizzle-orm";

// GET /api/v1/users - Search users
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    let userId: string | null = null;
    const currentUser = await getCurrentUser();

    if (currentUser) {
      userId = currentUser.id;
    } else {
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);
      if (session) {
        userId = session.userId;
      }
    }

    if (!userId) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const { data, errors: validationErrors } = validateParams(
      searchParams,
      searchSchema
    );

    if (validationErrors) {
      return validationError("Invalid parameters", validationErrors);
    }

    const { q, page, limit } = data;
    const offset = (page - 1) * limit;

    const db = await getDB();

    // Search by username or display name
    const searchPattern = `%${q}%`;

    const [searchResults, countResult] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          isVerified: users.isVerified,
        })
        .from(users)
        .where(
          or(
            like(users.username, searchPattern),
            like(users.displayName, searchPattern)
          )
        )
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          or(
            like(users.username, searchPattern),
            like(users.displayName, searchPattern)
          )
        ),
    ]);

    const total = countResult[0]?.count ?? 0;

    return success(searchResults, {
      page,
      limit,
      total,
      hasMore: offset + searchResults.length < total,
    });
  } catch (err) {
    console.error("Search users error:", err);
    return serverError("Failed to search users");
  }
}
