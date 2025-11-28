import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, users, likes } from "@/lib/db/schema";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import {
  success,
  unauthorized,
  validationError,
  serverError,
  createPostSchema,
  cursorPaginationSchema,
  validateBody,
  validateParams,
} from "@/lib/api";
import { eq, desc, lt, and, inArray } from "drizzle-orm";

// GET /api/v1/posts - Get feed (paginated)
export async function GET(request: NextRequest) {
  try {
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

    // Build query conditions
    const conditions = [eq(posts.visibility, "public")];

    if (cursor) {
      // Cursor is the createdAt timestamp of the last post
      conditions.push(lt(posts.createdAt, new Date(parseInt(cursor))));
    }

    // Get posts with author info
    const feedPosts = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaUrls: posts.mediaUrls,
        visibility: posts.visibility,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
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
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there's more

    const hasMore = feedPosts.length > limit;
    const resultPosts = hasMore ? feedPosts.slice(0, -1) : feedPosts;

    // Check if current user has liked these posts
    const postIds = resultPosts.map((p) => p.id);
    const userLikes =
      postIds.length > 0
        ? await db
            .select({ targetId: likes.targetId })
            .from(likes)
            .where(
              and(
                eq(likes.userId, userId),
                eq(likes.targetType, "post"),
                inArray(likes.targetId, postIds),
              ),
            )
        : [];

    const likedPostIds = new Set(userLikes.map((l) => l.targetId));

    // Add isLiked flag to posts
    const postsWithLikeStatus = resultPosts.map((post) => ({
      ...post,
      mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
      isLiked: likedPostIds.has(post.id),
    }));

    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1].createdAt.getTime().toString()
      : undefined;

    return success(postsWithLikeStatus, {
      cursor: nextCursor,
      limit,
      hasMore,
    });
  } catch (err) {
    console.error("Get feed error:", err);
    return serverError("Failed to get feed");
  }
}

// POST /api/v1/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
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
      createPostSchema,
    );

    if (validationErrors) {
      return validationError("Invalid input", validationErrors);
    }

    const { content, mediaUrls, visibility } = data;

    // Must have either content or media
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      return validationError("Post must have content or media");
    }

    const db = await getDB();

    // Create post
    const [newPost] = await db
      .insert(posts)
      .values({
        userId,
        content,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
        visibility,
      })
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

    return success(
      {
        id: newPost.id,
        content: newPost.content,
        mediaUrls: newPost.mediaUrls ? JSON.parse(newPost.mediaUrls) : [],
        visibility: newPost.visibility,
        likesCount: newPost.likesCount,
        commentsCount: newPost.commentsCount,
        sharesCount: newPost.sharesCount,
        createdAt: newPost.createdAt,
        author,
        isLiked: false,
      },
      undefined,
      201,
    );
  } catch (err) {
    console.error("Create post error:", err);
    return serverError("Failed to create post");
  }
}
