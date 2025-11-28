import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, likes, notifications } from "@/lib/db/schema";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import {
  success,
  unauthorized,
  notFound,
  error,
  serverError,
  ErrorCodes,
} from "@/lib/api";
import { eq, and, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ postId: string }>;
}

// POST /api/v1/posts/[postId]/like - Like a post
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;

    // Check authentication
    let userId: string | null = null;
    const currentUser = await getCurrentUser();

    if (currentUser) {
      userId = currentUser.id;
    } else {
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);
      if (session) {
        userId = session.userId;
      }
    }

    if (!userId) {
      return unauthorized();
    }

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({ id: posts.id, userId: posts.userId, likesCount: posts.likesCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // Check if already liked
    const [existingLike] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.targetType, "post"),
          eq(likes.targetId, postId)
        )
      )
      .limit(1);

    if (existingLike) {
      return error(ErrorCodes.ALREADY_EXISTS, "You have already liked this post", 409);
    }

    // Create like
    await db.insert(likes).values({
      userId,
      targetType: "post",
      targetId: postId,
    });

    // Increment likes count
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, postId));

    // Create notification for post owner (if not own post)
    if (post.userId !== userId) {
      await db.insert(notifications).values({
        userId: post.userId,
        type: "like",
        actorId: userId,
        targetType: "post",
        targetId: postId,
      });
    }

    return success({
      liked: true,
      likesCount: (post.likesCount ?? 0) + 1,
    });
  } catch (err) {
    console.error("Like post error:", err);
    return serverError("Failed to like post");
  }
}

// DELETE /api/v1/posts/[postId]/like - Unlike a post
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;

    // Check authentication
    let userId: string | null = null;
    const currentUser = await getCurrentUser();

    if (currentUser) {
      userId = currentUser.id;
    } else {
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);
      if (session) {
        userId = session.userId;
      }
    }

    if (!userId) {
      return unauthorized();
    }

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({ id: posts.id, likesCount: posts.likesCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // Check if like exists
    const [existingLike] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.targetType, "post"),
          eq(likes.targetId, postId)
        )
      )
      .limit(1);

    if (!existingLike) {
      return notFound("Like");
    }

    // Delete like
    await db
      .delete(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.targetType, "post"),
          eq(likes.targetId, postId)
        )
      );

    // Decrement likes count
    await db
      .update(posts)
      .set({ likesCount: sql`MAX(0, ${posts.likesCount} - 1)` })
      .where(eq(posts.id, postId));

    return success({
      liked: false,
      likesCount: Math.max(0, (post.likesCount ?? 0) - 1),
    });
  } catch (err) {
    console.error("Unlike post error:", err);
    return serverError("Failed to unlike post");
  }
}
