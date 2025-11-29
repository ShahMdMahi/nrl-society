import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users } from "@/lib/db/schema";
import {
  success,
  error,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, or, and, desc } from "drizzle-orm";

// GET /api/v1/friends - List friends or friend requests
async function handleGetFriends(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "accepted";

    const db = await getDB();

    if (status === "accepted") {
      // Get accepted friends
      const friendsList = await db
        .select({
          id: friendships.id,
          friendId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
          createdAt: friendships.createdAt,
        })
        .from(friendships)
        .innerJoin(
          users,
          or(
            and(
              eq(friendships.requesterId, user.id),
              eq(users.id, friendships.addresseeId)
            ),
            and(
              eq(friendships.addresseeId, user.id),
              eq(users.id, friendships.requesterId)
            )
          )
        )
        .where(
          and(
            or(
              eq(friendships.requesterId, user.id),
              eq(friendships.addresseeId, user.id)
            ),
            eq(friendships.status, "accepted")
          )
        )
        .orderBy(desc(friendships.createdAt));

      return success(friendsList);
    } else if (status === "pending") {
      // Get pending friend requests (received)
      const pendingRequests = await db
        .select({
          id: friendships.id,
          requesterId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
          createdAt: friendships.createdAt,
        })
        .from(friendships)
        .innerJoin(users, eq(users.id, friendships.requesterId))
        .where(
          and(
            eq(friendships.addresseeId, user.id),
            eq(friendships.status, "pending")
          )
        )
        .orderBy(desc(friendships.createdAt));

      return success(pendingRequests);
    } else if (status === "sent") {
      // Get sent friend requests
      const sentRequests = await db
        .select({
          id: friendships.id,
          addresseeId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
          createdAt: friendships.createdAt,
        })
        .from(friendships)
        .innerJoin(users, eq(users.id, friendships.addresseeId))
        .where(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.status, "pending")
          )
        )
        .orderBy(desc(friendships.createdAt));

      return success(sentRequests);
    }

    return error("INVALID_STATUS", "Invalid status parameter", 400);
  } catch (err) {
    logError(requestId, "get_friends_error", err);
    return serverError("Failed to fetch friends");
  }
}

export const GET = withAuth(handleGetFriends);
