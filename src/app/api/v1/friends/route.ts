import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, or, and, desc } from "drizzle-orm";

// GET /api/v1/friends - List friends or friend requests
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to view friends", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "accepted"; // accepted, pending, sent

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
              eq(friendships.requesterId, currentUser.id),
              eq(users.id, friendships.addresseeId)
            ),
            and(
              eq(friendships.addresseeId, currentUser.id),
              eq(users.id, friendships.requesterId)
            )
          )
        )
        .where(
          and(
            or(
              eq(friendships.requesterId, currentUser.id),
              eq(friendships.addresseeId, currentUser.id)
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
            eq(friendships.addresseeId, currentUser.id),
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
            eq(friendships.requesterId, currentUser.id),
            eq(friendships.status, "pending")
          )
        )
        .orderBy(desc(friendships.createdAt));

      return success(sentRequests);
    }

    return error("INVALID_STATUS", "Invalid status parameter", 400);
  } catch (err) {
    console.error("Get friends error:", err);
    return error("INTERNAL_ERROR", "Failed to fetch friends", 500);
  }
}
