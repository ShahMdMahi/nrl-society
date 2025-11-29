import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, likes, notifications } from "@/lib/db/schema";
import {
  success,
  notFound,
  error,
  serverError,
  ErrorCodes,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, and, sql } from "drizzle-orm";

interface LikeParams {
  postId: string;
}

// POST /api/v1/posts/[postId]/like - Like a post
async function handleLikePost(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: LikeParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        likesCount: posts.likesCount,
      })
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
          eq(likes.userId, user.id),
          eq(likes.targetType, "post"),
          eq(likes.targetId, postId)
        )
      )
      .limit(1);

    if (existingLike) {
      return error(
        ErrorCodes.ALREADY_EXISTS,
        "You have already liked this post",
        409
      );
    }

    // Create like
    await db.insert(likes).values({
      userId: user.id,
      targetType: "post",
      targetId: postId,
    });

    // Increment likes count
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, postId));

    // Create notification for post owner (if not own post)
    if (post.userId !== user.id) {
      await db.insert(notifications).values({
        userId: post.userId,
        type: "like",
        actorId: user.id,
        targetType: "post",
        targetId: postId,
      });
    }

    return success({
      liked: true,
      likesCount: (post.likesCount ?? 0) + 1,
    });
  } catch (err) {
    logError(requestId, "like_post_error", err);
    return serverError("Failed to like post");
  }
}

// DELETE /api/v1/posts/[postId]/like - Unlike a post
async function handleUnlikePost(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: LikeParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
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
          eq(likes.userId, user.id),
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
          eq(likes.userId, user.id),
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
    logError(requestId, "unlike_post_error", err);
    return serverError("Failed to unlike post");
  }
}

export const POST = withAuth<LikeParams>(handleLikePost);
export const DELETE = withAuth<LikeParams>(handleUnlikePost);
