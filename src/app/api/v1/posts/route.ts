import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, users, likes } from "@/lib/db/schema";
import {
  success,
  validationError,
  serverError,
  createPostSchema,
  cursorPaginationSchema,
  withAuth,
  parseBody,
  parseQuery,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, desc, lt, and, inArray, or, isNull } from "drizzle-orm";

// GET /api/v1/posts - Get feed (paginated)
async function handleGetFeed(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseQuery(searchParams, cursorPaginationSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { cursor, limit } = parsed.data;
    const db = await getDB();

    // Build query conditions - include posts with visibility 'public' or NULL (default)
    const visibilityCondition = or(
      eq(posts.visibility, "public"),
      isNull(posts.visibility)
    );

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
      .where(
        cursor
          ? and(
              visibilityCondition,
              lt(posts.createdAt, new Date(parseInt(cursor)))
            )
          : visibilityCondition
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

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
                eq(likes.userId, user.id),
                eq(likes.targetType, "post"),
                inArray(likes.targetId, postIds)
              )
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
    logError(requestId, "get_feed_error", err);
    return serverError("Failed to get feed");
  }
}

// POST /api/v1/posts - Create a new post
async function handleCreatePost(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const parsed = await parseBody(request, createPostSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { content, mediaUrls, visibility } = parsed.data;

    // Must have either content or media
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      return validationError("Post must have content or media");
    }

    const db = await getDB();

    // Create post
    const [newPost] = await db
      .insert(posts)
      .values({
        userId: user.id,
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
      .where(eq(users.id, user.id))
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
      201
    );
  } catch (err) {
    logError(requestId, "create_post_error", err);
    return serverError("Failed to create post");
  }
}

export const GET = withAuth(handleGetFeed);
export const POST = withAuth(handleCreatePost);
