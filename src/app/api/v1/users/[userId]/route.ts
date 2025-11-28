import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, posts, friendships } from "@/lib/db/schema";
import {
  getCurrentUser,
  validateApiSession,
  clearUserCache,
} from "@/lib/auth/session";
import {
  success,
  unauthorized,
  notFound,
  forbidden,
  validationError,
  serverError,
  updateProfileSchema,
  validateBody,
} from "@/lib/api";
import { eq, sql, or, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// GET /api/v1/users/[userId] - Get user profile
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;

    // Check authentication (optional for public profiles)
    let currentUserId: string | null = null;
    const currentUser = await getCurrentUser();

    if (currentUser) {
      currentUserId = currentUser.id;
    } else {
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);
      if (session) {
        currentUserId = session.userId;
      }
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

    if (currentUserId) {
      isOwnProfile = currentUserId === userId;

      if (!isOwnProfile) {
        const [friendship] = await db
          .select({ status: friendships.status, requesterId: friendships.requesterId })
          .from(friendships)
          .where(
            or(
              and(
                eq(friendships.requesterId, currentUserId),
                eq(friendships.addresseeId, userId)
              ),
              and(
                eq(friendships.requesterId, userId),
                eq(friendships.addresseeId, currentUserId)
              )
            )
          )
          .limit(1);

        if (friendship) {
          if (friendship.status === "pending") {
            friendshipStatus =
              friendship.requesterId === currentUserId
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
    console.error("Get user profile error:", err);
    return serverError("Failed to get user profile");
  }
}

// PATCH /api/v1/users/[userId] - Update user profile
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;

    // Check authentication
    let currentUserId: string | null = null;
    const currentUser = await getCurrentUser();

    if (currentUser) {
      currentUserId = currentUser.id;
    } else {
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);
      if (session) {
        currentUserId = session.userId;
      }
    }

    if (!currentUserId) {
      return unauthorized();
    }

    // Can only update own profile
    if (currentUserId !== userId) {
      return forbidden();
    }

    // Validate request body
    const { data, errors: validationErrors } = await validateBody(
      request,
      updateProfileSchema
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
    }

    const db = await getDB();

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
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
    console.error("Update user profile error:", err);
    return serverError("Failed to update profile");
  }
}
