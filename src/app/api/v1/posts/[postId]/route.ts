import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, users, likes } from "@/lib/db/schema";
import {
  success,
  notFound,
  forbidden,
  serverError,
  updatePostSchema,
  withAuth,
  withOptionalAuth,
  parseBody,
  logError,
  ApiContext,
  OptionalApiContext,
} from "@/lib/api";
import { eq, and } from "drizzle-orm";

interface PostParams {
  postId: string;
}

// GET /api/v1/posts/[postId] - Get single post
async function handleGetPost(
  _request: NextRequest,
  { user, requestId }: OptionalApiContext,
  params?: PostParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const db = await getDB();

    // Get post with author info
    const [post] = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaUrls: posts.mediaUrls,
        visibility: posts.visibility,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        userId: posts.userId,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // Check visibility permissions
    if (post.visibility !== "public" && post.userId !== user?.id) {
      return forbidden();
    }

    // Check if current user has liked this post
    let isLiked = false;
    if (user) {
      const [like] = await db
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
      isLiked = !!like;
    }

    return success({
      id: post.id,
      content: post.content,
      mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
      visibility: post.visibility,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      isLiked,
      isOwnPost: user?.id === post.userId,
    });
  } catch (err) {
    logError(requestId, "get_post_error", err);
    return serverError("Failed to get post");
  }
}

// PATCH /api/v1/posts/[postId] - Update post
async function handleUpdatePost(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: PostParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const parsed = await parseBody(request, updatePostSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const db = await getDB();

    // Check if post exists and belongs to user
    const [existingPost] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existingPost) {
      return notFound("Post");
    }

    if (existingPost.userId !== user.id) {
      return forbidden();
    }

    // Update post
    const [updatedPost] = await db
      .update(posts)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning();

    // Get author info
    const [author] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return success({
      id: updatedPost.id,
      content: updatedPost.content,
      mediaUrls: updatedPost.mediaUrls ? JSON.parse(updatedPost.mediaUrls) : [],
      visibility: updatedPost.visibility,
      likesCount: updatedPost.likesCount,
      commentsCount: updatedPost.commentsCount,
      sharesCount: updatedPost.sharesCount,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
      author,
      isOwnPost: true,
    });
  } catch (err) {
    logError(requestId, "update_post_error", err);
    return serverError("Failed to update post");
  }
}

// DELETE /api/v1/posts/[postId] - Delete post
async function handleDeletePost(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: PostParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const db = await getDB();

    // Check if post exists and belongs to user
    const [existingPost] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existingPost) {
      return notFound("Post");
    }

    if (existingPost.userId !== user.id) {
      return forbidden();
    }

    // Delete post (cascade will delete comments and likes)
    await db.delete(posts).where(eq(posts.id, postId));

    return success({ message: "Post deleted successfully" });
  } catch (err) {
    logError(requestId, "delete_post_error", err);
    return serverError("Failed to delete post");
  }
}

export const GET = withOptionalAuth<PostParams>(handleGetPost);
export const PATCH = withAuth<PostParams>(handleUpdatePost);
export const DELETE = withAuth<PostParams>(handleDeletePost);
