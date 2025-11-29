import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, friendships, follows, blocks } from "@/lib/db/schema";
import {
  success,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, and, or, ne, notInArray, sql, desc } from "drizzle-orm";

// GET /api/v1/users/suggestions - Get suggested users
async function handleGetSuggestions(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    const db = await getDB();

    // Get users the current user is already connected with
    const existingConnections = await db
      .select({ id: friendships.addresseeId })
      .from(friendships)
      .where(eq(friendships.requesterId, user.id))
      .union(
        db
          .select({ id: friendships.requesterId })
          .from(friendships)
          .where(eq(friendships.addresseeId, user.id))
      );

    const existingFollows = await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, user.id));

    const blockedUsers = await db
      .select({ id: blocks.blockedId })
      .from(blocks)
      .where(eq(blocks.blockerId, user.id));

    const blockedByUsers = await db
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(eq(blocks.blockedId, user.id));

    // Combine all excluded user IDs
    const excludedIds = [
      user.id,
      ...existingConnections.map((c) => c.id),
      ...existingFollows.map((f) => f.id),
      ...blockedUsers.map((b) => b.id),
      ...blockedByUsers.map((b) => b.id),
    ];

    // Get suggested users (prioritize verified and active users)
    const suggestions = await db
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
        and(
          excludedIds.length > 0
            ? notInArray(users.id, excludedIds)
            : ne(users.id, user.id),
          eq(users.isPrivate, false)
        )
      )
      .orderBy(desc(users.isVerified), desc(users.createdAt))
      .limit(limit);

    // Add mutual friends count (simplified - just showing random suggestions for now)
    const suggestionsWithMutuals = suggestions.map((s) => ({
      ...s,
      mutualFriendsCount: 0, // TODO: Calculate actual mutual friends
      reason: s.isVerified ? "Verified account" : "Suggested for you",
    }));

    return success(suggestionsWithMutuals);
  } catch (err) {
    logError(requestId, "get_suggestions_error", err);
    return serverError("Failed to fetch suggestions");
  }
}

export const GET = withAuth(handleGetSuggestions);
