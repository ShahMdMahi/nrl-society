import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users, notifications } from "@/lib/db/schema";
import {
  success,
  error,
  notFound,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, or, and } from "drizzle-orm";

interface FriendRequestParams {
  userId: string;
}

// POST /api/v1/friends/request/:userId - Send friend request
async function handleSendFriendRequest(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: FriendRequestParams
) {
  try {
    const targetUserId = params?.userId;
    if (!targetUserId) {
      return notFound("User");
    }

    if (targetUserId === user.id) {
      return error(
        "INVALID_REQUEST",
        "Cannot send friend request to yourself",
        400
      );
    }

    const db = await getDB();

    // Check if target user exists
    const [targetUser] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return notFound("User");
    }

    // Check if friendship already exists
    const existingFriendship = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.addresseeId, targetUserId)
          ),
          and(
            eq(friendships.requesterId, targetUserId),
            eq(friendships.addresseeId, user.id)
          )
        )
      )
      .limit(1);

    if (existingFriendship.length > 0) {
      const friendship = existingFriendship[0];
      if (friendship.status === "accepted") {
        return error(
          "ALREADY_FRIENDS",
          "You are already friends with this user",
          400
        );
      }
      if (friendship.status === "pending") {
        if (friendship.requesterId === user.id) {
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
      requesterId: user.id,
      addresseeId: targetUserId,
      status: "pending",
    });

    // Create notification for the recipient
    await db.insert(notifications).values({
      id: notificationId,
      userId: targetUserId,
      type: "friend_request",
      actorId: user.id,
      content: `sent you a friend request`,
    });

    return success({ message: "Friend request sent", friendshipId });
  } catch (err) {
    logError(requestId, "send_friend_request_error", err);
    return serverError("Failed to send friend request");
  }
}

// DELETE /api/v1/friends/request/:userId - Cancel friend request or unfriend
async function handleDeleteFriendship(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: FriendRequestParams
) {
  try {
    const targetUserId = params?.userId;
    if (!targetUserId) {
      return notFound("User");
    }

    const db = await getDB();

    // Find friendship
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.addresseeId, targetUserId)
          ),
          and(
            eq(friendships.requesterId, targetUserId),
            eq(friendships.addresseeId, user.id)
          )
        )
      )
      .limit(1);

    if (!friendship) {
      return notFound("Friendship");
    }

    // Delete the friendship
    await db.delete(friendships).where(eq(friendships.id, friendship.id));

    return success({ message: "Friendship removed" });
  } catch (err) {
    logError(requestId, "delete_friendship_error", err);
    return serverError("Failed to remove friendship");
  }
}

export const POST = withAuth<FriendRequestParams>(handleSendFriendRequest);
export const DELETE = withAuth<FriendRequestParams>(handleDeleteFriendship);
