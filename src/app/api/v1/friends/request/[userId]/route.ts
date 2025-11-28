import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users, notifications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, or, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// POST /api/v1/friends/request/:userId - Send friend request
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error(
        "UNAUTHORIZED",
        "Please log in to send friend requests",
        401,
      );
    }

    const { userId } = await context.params;

    if (userId === currentUser.id) {
      return error(
        "INVALID_REQUEST",
        "Cannot send friend request to yourself",
        400,
      );
    }

    const db = await getDB();

    // Check if target user exists
    const [targetUser] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return error("NOT_FOUND", "User not found", 404);
    }

    // Check if friendship already exists
    const existingFriendship = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, currentUser.id),
            eq(friendships.addresseeId, userId),
          ),
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, currentUser.id),
          ),
        ),
      )
      .limit(1);

    if (existingFriendship.length > 0) {
      const friendship = existingFriendship[0];
      if (friendship.status === "accepted") {
        return error(
          "ALREADY_FRIENDS",
          "You are already friends with this user",
          400,
        );
      }
      if (friendship.status === "pending") {
        if (friendship.requesterId === currentUser.id) {
          return error("REQUEST_PENDING", "Friend request already sent", 400);
        } else {
          // They sent us a request, so accept it instead
          await db
            .update(friendships)
            .set({ status: "accepted" })
            .where(eq(friendships.id, friendship.id));

          return success({ message: "Friend request accepted" });
        }
      }
      if (friendship.status === "blocked") {
        return error("BLOCKED", "Cannot send friend request to this user", 400);
      }
    }

    // Create friend request
    const friendshipId = crypto.randomUUID();
    const notificationId = crypto.randomUUID();

    await db.insert(friendships).values({
      id: friendshipId,
      requesterId: currentUser.id,
      addresseeId: userId,
      status: "pending",
    });

    // Create notification for the recipient
    await db.insert(notifications).values({
      id: notificationId,
      userId: userId,
      type: "friend_request",
      actorId: currentUser.id,
      content: `${currentUser.displayName} sent you a friend request`,
    });

    return success({ message: "Friend request sent", friendshipId });
  } catch (err) {
    console.error("Send friend request error:", err);
    return error("INTERNAL_ERROR", "Failed to send friend request", 500);
  }
}

// DELETE /api/v1/friends/request/:userId - Cancel friend request or unfriend
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to manage friendships", 401);
    }

    const { userId } = await context.params;

    const db = await getDB();

    // Find friendship
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, currentUser.id),
            eq(friendships.addresseeId, userId),
          ),
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, currentUser.id),
          ),
        ),
      )
      .limit(1);

    if (!friendship) {
      return error("NOT_FOUND", "Friendship not found", 404);
    }

    // Delete the friendship
    await db.delete(friendships).where(eq(friendships.id, friendship.id));

    return success({ message: "Friendship removed" });
  } catch (err) {
    console.error("Delete friendship error:", err);
    return error("INTERNAL_ERROR", "Failed to remove friendship", 500);
  }
}
