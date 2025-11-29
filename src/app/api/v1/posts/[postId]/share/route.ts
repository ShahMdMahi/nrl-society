import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { shares, posts, users, notifications } from "@/lib/db/schema";
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
import { eq, and, sql } from "drizzle-orm";

interface ShareParams {
  postId: string;
}

// POST /api/v1/posts/[postId]/share - Share/repost
async function handleSharePost(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: ShareParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const body = (await request.json().catch(() => ({}))) as {
      comment?: string;
    };
    const { comment } = body;

    const db = await getDB();

    // Check if post exists
    const [post] = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        sharesCount: posts.sharesCount,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return notFound("Post");
    }

    // Check if already shared
    const [existing] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(and(eq(shares.userId, user.id), eq(shares.postId, postId)))
      .limit(1);

    if (existing) {
      return error(
        ErrorCodes.ALREADY_EXISTS,
        "You have already shared this post",
        409
      );
    }

    // Create share
    await db.insert(shares).values({
      userId: user.id,
      postId,
      comment: comment || null,
    });

    // Increment shares count
    await db
      .update(posts)
      .set({ sharesCount: sql`${posts.sharesCount} + 1` })
      .where(eq(posts.id, postId));

    // Create notification for post owner (if not own post)
    if (post.userId !== user.id) {
      await db.insert(notifications).values({
        userId: post.userId,
        type: "mention", // Using mention type for share notifications
        actorId: user.id,
        targetType: "post",
        targetId: postId,
        content: "shared your post",
      });
    }

    return success({
      shared: true,
      sharesCount: (post.sharesCount ?? 0) + 1,
    });
  } catch (err) {
    logError(requestId, "share_post_error", err);
    return serverError("Failed to share post");
  }
}

// DELETE /api/v1/posts/[postId]/share - Unshare/remove repost
async function handleUnsharePost(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: ShareParams
) {
  try {
    const postId = params?.postId;
    if (!postId) {
      return notFound("Post");
    }

    const db = await getDB();

    // Check if shared
    const [share] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(and(eq(shares.userId, user.id), eq(shares.postId, postId)))
      .limit(1);

    if (!share) {
      return error(ErrorCodes.NOT_FOUND, "Share not found", 404);
    }

    // Get current post
    const [post] = await db
      .select({ sharesCount: posts.sharesCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    // Remove share
    await db
      .delete(shares)
      .where(and(eq(shares.userId, user.id), eq(shares.postId, postId)));

    // Decrement shares count
    await db
      .update(posts)
      .set({
        sharesCount: sql`CASE WHEN ${posts.sharesCount} > 0 THEN ${posts.sharesCount} - 1 ELSE 0 END`,
      })
      .where(eq(posts.id, postId));

    return success({
      shared: false,
      sharesCount: Math.max((post?.sharesCount ?? 0) - 1, 0),
    });
  } catch (err) {
    logError(requestId, "unshare_post_error", err);
    return serverError("Failed to unshare post");
  }
}

export const POST = withAuth((req: NextRequest, ctx: ApiContext) =>
  handleSharePost(req, ctx, {
    postId: req.url.split("/posts/")[1]?.split("/")[0] || "",
  })
);

export const DELETE = withAuth((req: NextRequest, ctx: ApiContext) =>
  handleUnsharePost(req, ctx, {
    postId: req.url.split("/posts/")[1]?.split("/")[0] || "",
  })
);
