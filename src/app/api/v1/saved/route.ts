import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { savedPosts, posts, users, likes } from "@/lib/db/schema";
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
import { eq, and, desc } from "drizzle-orm";

// GET /api/v1/saved - Get user's saved posts
async function handleGetSavedPosts(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor");

    const db = await getDB();

    // Build conditions
    const conditions = [eq(savedPosts.userId, user.id)];
    if (cursor) {
      conditions.push(eq(savedPosts.createdAt, new Date(parseInt(cursor))));
    }

    // Get saved posts with post data
    const saved = await db
      .select({
        savedId: savedPosts.id,
        savedAt: savedPosts.createdAt,
        post: {
          id: posts.id,
          content: posts.content,
          mediaUrls: posts.mediaUrls,
          visibility: posts.visibility,
          likesCount: posts.likesCount,
          commentsCount: posts.commentsCount,
          sharesCount: posts.sharesCount,
          createdAt: posts.createdAt,
        },
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
        },
      })
      .from(savedPosts)
      .innerJoin(posts, eq(savedPosts.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(savedPosts.createdAt))
      .limit(limit + 1);

    const hasMore = saved.length > limit;
    const items = hasMore ? saved.slice(0, -1) : saved;

    // Check if user has liked each post
    const postsWithLikes = await Promise.all(
      items.map(async (item) => {
        const [like] = await db
          .select({ id: likes.id })
          .from(likes)
          .where(
            and(
              eq(likes.userId, user.id),
              eq(likes.targetType, "post"),
              eq(likes.targetId, item.post.id)
            )
          )
          .limit(1);

        return {
          ...item.post,
          mediaUrls: item.post.mediaUrls ? JSON.parse(item.post.mediaUrls) : [],
          createdAt: item.post.createdAt.toISOString(),
          author: item.author,
          isLiked: !!like,
          isSaved: true,
          savedAt: item.savedAt.toISOString(),
        };
      })
    );

    return success(postsWithLikes, {
      cursor: hasMore
        ? items[items.length - 1].savedAt.getTime().toString()
        : undefined,
      hasMore,
    });
  } catch (err) {
    logError(requestId, "get_saved_posts_error", err);
    return serverError("Failed to fetch saved posts");
  }
}

// POST /api/v1/saved - Save a post
async function handleSavePost(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = (await request.json()) as { postId: string };
    const { postId } = body;

    if (!postId) {
      return error(ErrorCodes.INVALID_REQUEST, "Post ID is required", 400);
    }

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

    // Check if already saved
    const [existing] = await db
      .select({ id: savedPosts.id })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, user.id), eq(savedPosts.postId, postId)))
      .limit(1);

    if (existing) {
      return error(ErrorCodes.ALREADY_EXISTS, "Post already saved", 409);
    }

    // Save post
    await db.insert(savedPosts).values({
      userId: user.id,
      postId,
    });

    return success({ saved: true });
  } catch (err) {
    logError(requestId, "save_post_error", err);
    return serverError("Failed to save post");
  }
}

// DELETE /api/v1/saved - Unsave a post
async function handleUnsavePost(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return error(ErrorCodes.INVALID_REQUEST, "Post ID is required", 400);
    }

    const db = await getDB();

    // Check if saved
    const [saved] = await db
      .select({ id: savedPosts.id })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, user.id), eq(savedPosts.postId, postId)))
      .limit(1);

    if (!saved) {
      return notFound("Saved post");
    }

    // Remove save
    await db
      .delete(savedPosts)
      .where(
        and(eq(savedPosts.userId, user.id), eq(savedPosts.postId, postId))
      );

    return success({ saved: false });
  } catch (err) {
    logError(requestId, "unsave_post_error", err);
    return serverError("Failed to unsave post");
  }
}

export const GET = withAuth(handleGetSavedPosts);
export const POST = withAuth(handleSavePost);
export const DELETE = withAuth(handleUnsavePost);
