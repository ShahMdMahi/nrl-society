import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships, users, notifications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// POST /api/v1/friends/accept/:userId - Accept friend request
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error(
        "UNAUTHORIZED",
        "Please log in to accept friend requests",
        401,
      );
    }

    const { userId } = await context.params;

    const db = await getDB();

    // Find pending friend request where the other user is the requester
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, currentUser.id),
          eq(friendships.status, "pending"),
        ),
      )
      .limit(1);

    if (!friendship) {
      return error("NOT_FOUND", "Friend request not found", 404);
    }

    // Get requester info for notification
    const [requester] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
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
      userId: userId,
      type: "friend_accepted",
      actorId: currentUser.id,
      content: `${currentUser.displayName} accepted your friend request`,
    });

    return success({
      message: "Friend request accepted",
      friend: {
        id: userId,
        displayName: requester?.displayName,
      },
    });
  } catch (err) {
    console.error("Accept friend request error:", err);
    return error("INTERNAL_ERROR", "Failed to accept friend request", 500);
  }
}
