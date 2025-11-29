import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import {
  success,
  serverError,
  searchSchema,
  withAuth,
  parseQuery,
  logError,
  ApiContext,
} from "@/lib/api";
import { like, or, sql } from "drizzle-orm";

// GET /api/v1/users - Search users
async function handleSearchUsers(
  request: NextRequest,
  { requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, searchSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { q, page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const db = await getDB();

    // Search by username or display name (case-insensitive)
    const searchPattern = `%${q.toLowerCase()}%`;

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
            like(sql`LOWER(${users.username})`, searchPattern),
            like(sql`LOWER(${users.displayName})`, searchPattern)
          )
        )
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          or(
            like(sql`LOWER(${users.username})`, searchPattern),
            like(sql`LOWER(${users.displayName})`, searchPattern)
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
    logError(requestId, "search_users_error", err);
    return serverError("Failed to search users");
  }
}

export const GET = withAuth(handleSearchUsers);
