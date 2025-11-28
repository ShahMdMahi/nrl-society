import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, comments, users, notifications } from "@/lib/db/schema";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import {
  success,
  unauthorized,
  notFound,
  validationError,
  serverError,
  createCommentSchema,
  cursorPaginationSchema,
  validateBody,
  validateParams,
} from "@/lib/api";
import { eq, and, desc, lt, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ postId: string }>;
}

// GET /api/v1/posts/[postId]/comments - Get comments for a post
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

    const { searchParams } = new URL(request.url);
    const { data, errors: validationErrors } = validateParams(
      searchParams,
      cursorPaginationSchema,
    );

    if (validationErrors) {
      return validationError("Invalid parameters", validationErrors);
    }

    const { cursor, limit } = data;

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // Build query conditions
    const conditions = [eq(comments.postId, postId)];

    if (cursor) {
      conditions.push(lt(comments.createdAt, new Date(parseInt(cursor))));
    }

    // Get comments with author info
    const postComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        parentId: comments.parentId,
        likesCount: comments.likesCount,
        createdAt: comments.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(comments.createdAt))
      .limit(limit + 1);

    const hasMore = postComments.length > limit;
    const resultComments = hasMore ? postComments.slice(0, -1) : postComments;

    // Add isOwnComment flag
    const commentsWithOwnership = resultComments.map((comment) => ({
      ...comment,
      isOwnComment: userId === comment.author.id,
    }));

    const nextCursor = hasMore
      ? resultComments[resultComments.length - 1].createdAt.getTime().toString()
      : undefined;

    return success(commentsWithOwnership, {
      cursor: nextCursor,
      limit,
      hasMore,
    });
  } catch (err) {
    console.error("Get comments error:", err);
    return serverError("Failed to get comments");
  }
}

// POST /api/v1/posts/[postId]/comments - Create a comment
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

    // Validate request body
    const { data, errors: validationErrors } = await validateBody(
      request,
      createCommentSchema,
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
    }

    const { content, parentId } = data;

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        commentsCount: posts.commentsCount,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // If parentId is provided, check if parent comment exists
    if (parentId) {
      const [parentComment] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.id, parentId), eq(comments.postId, postId)))
        .limit(1);

      if (!parentComment) {
        return notFound("Parent comment");
      }
    }

    // Create comment
    const [newComment] = await db
      .insert(comments)
      .values({
        postId,
        userId,
        parentId,
        content,
      })
      .returning();

    // Increment comments count on post
    await db
      .update(posts)
      .set({ commentsCount: sql`${posts.commentsCount} + 1` })
      .where(eq(posts.id, postId));

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

    // Create notification for post owner (if not own post)
    if (post.userId !== userId) {
      await db.insert(notifications).values({
        userId: post.userId,
        type: "comment",
        actorId: userId,
        targetType: "post",
        targetId: postId,
        content: content.slice(0, 100), // Preview of comment
      });
    }

    return success(
      {
        id: newComment.id,
        content: newComment.content,
        parentId: newComment.parentId,
        likesCount: newComment.likesCount,
        createdAt: newComment.createdAt,
        author,
        isOwnComment: true,
      },
      undefined,
      201,
    );
  } catch (err) {
    console.error("Create comment error:", err);
    return serverError("Failed to create comment");
  }
}
