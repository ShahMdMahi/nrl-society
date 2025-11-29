import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { follows, users, notifications } from "@/lib/db/schema";
import {
  success,
  error,
  notFound,
  serverError,
  ErrorCodes,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, and, desc, sql } from "drizzle-orm";

// GET /api/v1/follows - Get followers or following
async function handleGetFollows(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "following"; // following or followers
    const userId = searchParams.get("userId") || user.id;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const db = await getDB();

    if (type === "followers") {
      // Get users who follow the target user
      const followers = await db
        .select({
          id: follows.id,
          followedAt: follows.createdAt,
          user: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            isVerified: users.isVerified,
            bio: users.bio,
          },
        })
        .from(follows)
        .innerJoin(users, eq(follows.followerId, users.id))
        .where(eq(follows.followingId, userId))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset);

      // Check if current user follows each follower
      const followersWithStatus = await Promise.all(
        followers.map(async (f) => {
          const [isFollowing] = await db
            .select({ id: follows.id })
            .from(follows)
            .where(
              and(
                eq(follows.followerId, user.id),
                eq(follows.followingId, f.user.id)
              )
            )
            .limit(1);

          return {
            ...f,
            followedAt: f.followedAt.toISOString(),
            isFollowing: !!isFollowing,
          };
        })
      );

      return success(followersWithStatus);
    } else {
      // Get users the target user follows
      const following = await db
        .select({
          id: follows.id,
          followedAt: follows.createdAt,
          user: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            isVerified: users.isVerified,
            bio: users.bio,
          },
        })
        .from(follows)
        .innerJoin(users, eq(follows.followingId, users.id))
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset);

      // Check if current user follows each user
      const followingWithStatus = await Promise.all(
        following.map(async (f) => {
          const [isFollowing] = await db
            .select({ id: follows.id })
            .from(follows)
            .where(
              and(
                eq(follows.followerId, user.id),
                eq(follows.followingId, f.user.id)
              )
            )
            .limit(1);

          return {
            ...f,
            followedAt: f.followedAt.toISOString(),
            isFollowing: !!isFollowing || f.user.id === user.id,
          };
        })
      );

      return success(followingWithStatus);
    }
  } catch (err) {
    logError(requestId, "get_follows_error", err);
    return serverError("Failed to fetch follows");
  }
}

// POST /api/v1/follows - Follow a user
async function handleFollowUser(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = (await request.json()) as { userId: string };
    const { userId } = body;

    if (!userId) {
      return error(ErrorCodes.INVALID_REQUEST, "User ID is required", 400);
    }

    if (userId === user.id) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "You cannot follow yourself",
        400
      );
    }

    const db = await getDB();

    // Check if user exists
    const [targetUser] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return notFound("User");
    }

    // Check if already following
    const [existing] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(eq(follows.followerId, user.id), eq(follows.followingId, userId))
      )
      .limit(1);

    if (existing) {
      return error(
        ErrorCodes.ALREADY_EXISTS,
        "Already following this user",
        409
      );
    }

    // Create follow
    await db.insert(follows).values({
      followerId: user.id,
      followingId: userId,
    });

    // Create notification
    await db.insert(notifications).values({
      userId,
      type: "friend_request", // Using friend_request type for follow notifications
      actorId: user.id,
      targetType: "user",
      targetId: user.id,
      content: "started following you",
    });

    // Get updated follower count
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    return success({
      following: true,
      followersCount: count?.count ?? 0,
    });
  } catch (err) {
    logError(requestId, "follow_user_error", err);
    return serverError("Failed to follow user");
  }
}

// DELETE /api/v1/follows - Unfollow a user
async function handleUnfollowUser(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return error(ErrorCodes.INVALID_REQUEST, "User ID is required", 400);
    }

    const db = await getDB();

    // Check if following
    const [follow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(eq(follows.followerId, user.id), eq(follows.followingId, userId))
      )
      .limit(1);

    if (!follow) {
      return error(ErrorCodes.NOT_FOUND, "Not following this user", 404);
    }

    // Remove follow
    await db
      .delete(follows)
      .where(
        and(eq(follows.followerId, user.id), eq(follows.followingId, userId))
      );

    // Get updated follower count
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    return success({
      following: false,
      followersCount: count?.count ?? 0,
    });
  } catch (err) {
    logError(requestId, "unfollow_user_error", err);
    return serverError("Failed to unfollow user");
  }
}

export const GET = withAuth(handleGetFollows);
export const POST = withAuth(handleFollowUser);
export const DELETE = withAuth(handleUnfollowUser);
