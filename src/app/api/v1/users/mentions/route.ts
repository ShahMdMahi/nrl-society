import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import {
  success,
  validationError,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { like, sql, ne, and } from "drizzle-orm";
import { z } from "zod";

const mentionSearchSchema = z.object({
  q: z.string().min(1).max(30),
});

// GET /api/v1/users/mentions?q=username - Search users for @mention autocomplete
async function handleMentionSearch(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 1) {
      return validationError("Query parameter 'q' is required");
    }

    const parsed = mentionSearchSchema.safeParse({ q });
    if (!parsed.success) {
      return validationError("Invalid query parameter");
    }

    const db = await getDB();

    // Search by username or display name (case-insensitive), excluding current user
    const searchPattern = `${q.toLowerCase()}%`; // Start with for faster matching

    const searchResults = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          ne(users.id, user.id), // Exclude current user
          like(sql`LOWER(${users.username})`, searchPattern)
        )
      )
      .limit(8); // Limit to 8 results for autocomplete

    return success(searchResults);
  } catch (err) {
    logError(requestId, "mention_search_error", err);
    return serverError("Failed to search users");
  }
}

export const GET = withAuth(handleMentionSearch);
