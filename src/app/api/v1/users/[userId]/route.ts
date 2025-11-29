import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, posts, friendships } from "@/lib/db/schema";
import { clearUserCache } from "@/lib/auth/session";
import {
  success,
  notFound,
  forbidden,
  serverError,
  updateProfileSchema,
  withAuth,
  withOptionalAuth,
  parseBody,
  logError,
  ApiContext,
  OptionalApiContext,
} from "@/lib/api";
import { eq, sql, or, and } from "drizzle-orm";

interface UserParams {
  userId: string;
}

// GET /api/v1/users/[userId] - Get user profile
async function handleGetUserProfile(
  _request: NextRequest,
  { user: currentUser, requestId }: OptionalApiContext,
  params?: UserParams
) {
  try {
    const userId = params?.userId;
    if (!userId) {
      return notFound("User");
    }

    const db = await getDB();

    // Get user profile
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        isVerified: users.isVerified,
        isPrivate: users.isPrivate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return notFound("User");
    }

    // Get post count
    const [postCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.userId, userId));

    // Get friends count (accepted friendships)
    const [friendsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(friendships)
      .where(
        and(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId)
          ),
          eq(friendships.status, "accepted")
        )
      );

    // Check friendship status with current user
    let friendshipStatus: string | null = null;
    let isOwnProfile = false;

    if (currentUser) {
      isOwnProfile = currentUser.id === userId;

      if (!isOwnProfile) {
        const [friendship] = await db
          .select({
            status: friendships.status,
            requesterId: friendships.requesterId,
          })
          .from(friendships)
          .where(
            or(
              and(
                eq(friendships.requesterId, currentUser.id),
                eq(friendships.addresseeId, userId)
              ),
              and(
                eq(friendships.requesterId, userId),
                eq(friendships.addresseeId, currentUser.id)
              )
            )
          )
          .limit(1);

        if (friendship) {
          if (friendship.status === "pending") {
            friendshipStatus =
              friendship.requesterId === currentUser.id
                ? "pending_sent"
                : "pending_received";
          } else {
            friendshipStatus = friendship.status;
          }
        }
      }
    }

    return success({
      user: {
        ...user,
        postsCount: postCount?.count ?? 0,
        friendsCount: friendsCount?.count ?? 0,
        friendshipStatus,
        isOwnProfile,
      },
    });
  } catch (err) {
    logError(requestId, "get_user_profile_error", err);
    return serverError("Failed to get user profile");
  }
}

// PATCH /api/v1/users/[userId] - Update user profile
async function handleUpdateUserProfile(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: UserParams
) {
  try {
    const userId = params?.userId;
    if (!userId) {
      return notFound("User");
    }

    // Can only update own profile
    if (user.id !== userId) {
      return forbidden();
    }

    const parsed = await parseBody(request, updateProfileSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const db = await getDB();

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        isVerified: users.isVerified,
        isPrivate: users.isPrivate,
      });

    if (!updatedUser) {
      return notFound("User");
    }

    // Clear user cache
    await clearUserCache(userId);

    return success({ user: updatedUser });
  } catch (err) {
    logError(requestId, "update_user_profile_error", err);
    return serverError("Failed to update profile");
  }
}

export const GET = withOptionalAuth<UserParams>(handleGetUserProfile);
export const PATCH = withAuth<UserParams>(handleUpdateUserProfile);
