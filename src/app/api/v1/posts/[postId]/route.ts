import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, users, likes } from "@/lib/db/schema";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import {
  success,
  unauthorized,
  notFound,
  forbidden,
  validationError,
  serverError,
  updatePostSchema,
  validateBody,
} from "@/lib/api";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ postId: string }>;
}

// GET /api/v1/posts/[postId] - Get single post
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;

    // Check authentication (optional)
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
    if (post.visibility !== "public" && post.userId !== userId) {
      // TODO: Check if friends for "friends" visibility
      return forbidden();
    }

    // Check if current user has liked this post
    let isLiked = false;
    if (userId) {
      const [like] = await db
        .select({ id: likes.id })
        .from(likes)
        .where(
          and(
            eq(likes.userId, userId),
            eq(likes.targetType, "post"),
            eq(likes.targetId, postId),
          ),
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
      isOwnPost: userId === post.userId,
    });
  } catch (err) {
    console.error("Get post error:", err);
    return serverError("Failed to get post");
  }
}

// PATCH /api/v1/posts/[postId] - Update post
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Validate request body
    const { data, errors: validationErrors } = await validateBody(
      request,
      updatePostSchema,
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
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

    if (existingPost.userId !== userId) {
      return forbidden();
    }

    // Update post
    const [updatedPost] = await db
      .update(posts)
      .set({
        ...data,
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
      .where(eq(users.id, userId))
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
    console.error("Update post error:", err);
    return serverError("Failed to update post");
  }
}

// DELETE /api/v1/posts/[postId] - Delete post
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

    // Check if post exists and belongs to user
    const [existingPost] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existingPost) {
      return notFound("Post");
    }

    if (existingPost.userId !== userId) {
      return forbidden();
    }

    // Delete post (cascade will delete comments and likes)
    await db.delete(posts).where(eq(posts.id, postId));

    return success({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
    return serverError("Failed to delete post");
  }
}
