import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships } from "@/lib/db/schema";
import {
  success,
  notFound,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, and } from "drizzle-orm";

interface RejectParams {
  userId: string;
}

// POST /api/v1/friends/reject/:userId - Reject friend request
async function handleRejectFriendRequest(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: RejectParams
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

    // Delete the friend request
    await db.delete(friendships).where(eq(friendships.id, friendship.id));

    return success({ message: "Friend request rejected" });
  } catch (err) {
    logError(requestId, "reject_friend_request_error", err);
    return serverError("Failed to reject friend request");
  }
}

export const POST = withAuth<RejectParams>(handleRejectFriendRequest);
