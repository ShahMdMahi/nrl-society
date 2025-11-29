import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { posts, users, likes, hashtags } from "@/lib/db/schema";
import {
  success,
  serverError,
  withOptionalAuth,
  logError,
  OptionalApiContext,
} from "@/lib/api";
import { desc, sql, eq, and, gte } from "drizzle-orm";

// GET /api/v1/trending - Get trending posts and hashtags
async function handleGetTrending(
  request: NextRequest,
  { user, requestId }: OptionalApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // all, posts, hashtags
    const period = searchParams.get("period") || "day"; // day, week, month
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const db = await getDB();

    // Calculate time threshold based on period
    const now = Date.now();
    const periodMs =
      {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      }[period] || 24 * 60 * 60 * 1000;

    const threshold = new Date(now - periodMs);

    const results: {
      posts?: Array<{
        id: string;
        content: string | null;
        mediaUrls: string[];
        likesCount: number | null;
        commentsCount: number | null;
        sharesCount: number | null;
        createdAt: string;
        author: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          isVerified: boolean | null;
        };
        isLiked: boolean;
        engagementScore: number;
      }>;
      hashtags?: Array<{
        id: string;
        name: string;
        postCount: number | null;
      }>;
    } = {};

    // Get trending posts (sorted by engagement)
    if (type === "all" || type === "posts") {
      const trendingPosts = await db
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
          and(eq(posts.visibility, "public"), gte(posts.createdAt, threshold))
        )
        .orderBy(
          desc(
            sql`(${posts.likesCount} * 3 + ${posts.commentsCount} * 5 + ${posts.sharesCount} * 7)`
          )
        )
        .limit(limit);

      // Check if user has liked each post
      const postsWithLikes = await Promise.all(
        trendingPosts.map(async (post) => {
          let isLiked = false;
          if (user) {
            const [like] = await db
              .select({ id: likes.id })
              .from(likes)
              .where(
                and(
                  eq(likes.userId, user.id),
                  eq(likes.targetType, "post"),
                  eq(likes.targetId, post.id)
                )
              )
              .limit(1);
            isLiked = !!like;
          }

          const engagementScore =
            (post.likesCount ?? 0) * 3 +
            (post.commentsCount ?? 0) * 5 +
            (post.sharesCount ?? 0) * 7;

          return {
            ...post,
            mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
            createdAt: post.createdAt.toISOString(),
            isLiked,
            engagementScore,
          };
        })
      );

      results.posts = postsWithLikes;
    }

    // Get trending hashtags
    if (type === "all" || type === "hashtags") {
      const trendingHashtags = await db
        .select({
          id: hashtags.id,
          name: hashtags.name,
          postCount: hashtags.postCount,
        })
        .from(hashtags)
        .orderBy(desc(hashtags.postCount))
        .limit(type === "hashtags" ? limit : 10);

      results.hashtags = trendingHashtags;
    }

    return success(results);
  } catch (err) {
    logError(requestId, "get_trending_error", err);
    return serverError("Failed to fetch trending content");
  }
}

export const GET = withOptionalAuth(handleGetTrending);
