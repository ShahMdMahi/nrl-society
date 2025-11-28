import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { friendships } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// POST /api/v1/friends/reject/:userId - Reject friend request
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error(
        "UNAUTHORIZED",
        "Please log in to reject friend requests",
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

    // Delete the friend request
    await db.delete(friendships).where(eq(friendships.id, friendship.id));

    return success({ message: "Friend request rejected" });
  } catch (err) {
    console.error("Reject friend request error:", err);
    return error("INTERNAL_ERROR", "Failed to reject friend request", 500);
  }
}
