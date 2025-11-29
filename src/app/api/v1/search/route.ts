import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users, posts, hashtags, postHashtags } from "@/lib/db/schema";
import {
  success,
  serverError,
  withOptionalAuth,
  logError,
  OptionalApiContext,
} from "@/lib/api";
import { like, desc, sql, or, eq } from "drizzle-orm";

// GET /api/v1/search - Search users and posts
async function handleSearch(
  request: NextRequest,
  { user, requestId }: OptionalApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const type = searchParams.get("type") || "all"; // all, users, posts, hashtags
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query || query.length < 2) {
      return success({ users: [], posts: [], hashtags: [] });
    }

    const db = await getDB();
    const searchTerm = `%${query}%`;
    const results: {
      users?: Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        isVerified: boolean | null;
        bio: string | null;
      }>;
      posts?: Array<{
        id: string;
        content: string | null;
        createdAt: Date;
        author: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          isVerified: boolean | null;
        };
        likesCount: number | null;
        commentsCount: number | null;
      }>;
      hashtags?: Array<{
        id: string;
        name: string;
        postCount: number | null;
      }>;
    } = {};

    // Search users
    if (type === "all" || type === "users") {
      const userResults = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
          bio: users.bio,
        })
        .from(users)
        .where(
          or(
            like(users.username, searchTerm),
            like(users.displayName, searchTerm)
          )
        )
        .limit(type === "users" ? limit : 5)
        .offset(type === "users" ? offset : 0);

      results.users = userResults;
    }

    // Search posts
    if (type === "all" || type === "posts") {
      const postResults = await db
        .select({
          id: posts.id,
          content: posts.content,
          createdAt: posts.createdAt,
          likesCount: posts.likesCount,
          commentsCount: posts.commentsCount,
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
        .where(like(posts.content, searchTerm))
        .orderBy(desc(posts.createdAt))
        .limit(type === "posts" ? limit : 5)
        .offset(type === "posts" ? offset : 0);

      results.posts = postResults.map((p) => ({
        ...p,
        createdAt: p.createdAt,
      }));
    }

    // Search hashtags
    if (type === "all" || type === "hashtags") {
      const hashtagResults = await db
        .select({
          id: hashtags.id,
          name: hashtags.name,
          postCount: hashtags.postCount,
        })
        .from(hashtags)
        .where(like(hashtags.name, searchTerm))
        .orderBy(desc(hashtags.postCount))
        .limit(type === "hashtags" ? limit : 5)
        .offset(type === "hashtags" ? offset : 0);

      results.hashtags = hashtagResults;
    }

    return success(results);
  } catch (err) {
    logError(requestId, "search_error", err);
    return serverError("Search failed");
  }
}

export const GET = withOptionalAuth(handleSearch);
