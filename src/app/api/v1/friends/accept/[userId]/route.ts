import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users, notifications } from "@/lib/db/schema";
import {
  success,
  notFound,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, and } from "drizzle-orm";

interface AcceptParams {
  userId: string;
}

// POST /api/v1/friends/accept/:userId - Accept friend request
async function handleAcceptFriendRequest(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: AcceptParams
) {
  try {
    const requesterId = params?.userId;
    if (!requesterId) {
      return notFound("Friend request");
    }

    const db = await getDB();

    // Find pending friend request where the other user is the requester
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.requesterId, requesterId),
          eq(friendships.addresseeId, user.id),
          eq(friendships.status, "pending")
        )
      )
      .limit(1);

    if (!friendship) {
      return notFound("Friend request");
    }

    // Get requester info for notification
    const [requester] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);

    // Accept the friend request
    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(eq(friendships.id, friendship.id));

    // Create notification for the requester
    const notificationId = crypto.randomUUID();
    await db.insert(notifications).values({
      id: notificationId,
      userId: requesterId,
      type: "friend_accepted",
      actorId: user.id,
      content: `accepted your friend request`,
    });

    return success({
      message: "Friend request accepted",
      friend: {
        id: requesterId,
        displayName: requester?.displayName,
      },
    });
  } catch (err) {
    logError(requestId, "accept_friend_request_error", err);
    return serverError("Failed to accept friend request");
  }
}

export const POST = withAuth<AcceptParams>(handleAcceptFriendRequest);
