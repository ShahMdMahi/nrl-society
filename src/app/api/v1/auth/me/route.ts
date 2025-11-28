import { NextRequest } from "next/server";
import { getCurrentUser, validateApiSession } from "@/lib/auth/session";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import { success, unauthorized, notFound, serverError } from "@/lib/api";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Try cookie-based auth first (web), then header-based (mobile)
    const user = await getCurrentUser();

    if (!user) {
      // Try Authorization header for mobile apps
      const authHeader = request.headers.get("Authorization");
      const session = await validateApiSession(authHeader);

      if (!session) {
        return unauthorized();
      }

      // Fetch user from database
      const db = await getDB();
      const [dbUser] = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          bio: users.bio,
          avatarUrl: users.avatarUrl,
          coverUrl: users.coverUrl,
          isVerified: users.isVerified,
          isPrivate: users.isPrivate,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!dbUser) {
        return notFound("User");
      }

      return success({
        user: {
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          displayName: dbUser.displayName,
          bio: dbUser.bio,
          avatarUrl: dbUser.avatarUrl,
          coverUrl: dbUser.coverUrl,
          isVerified: dbUser.isVerified,
          isPrivate: dbUser.isPrivate,
          createdAt: dbUser.createdAt,
        },
      });
    }

    // Get full user data for web
    const db = await getDB();
    const [fullUser] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        isVerified: users.isVerified,
        isPrivate: users.isPrivate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!fullUser) {
      return notFound("User");
    }

    return success({
      user: fullUser,
    });
  } catch (err) {
    console.error("Get current user error:", err);
    return serverError("Failed to get user");
  }
}
