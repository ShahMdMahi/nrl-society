import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { users } from "@/lib/db/schema";
import {
  success,
  notFound,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq } from "drizzle-orm";

async function handleGetCurrentUser(
  _request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
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

    return success({ user: fullUser });
  } catch (err) {
    logError(requestId, "get_current_user_error", err);
    return serverError("Failed to get user");
  }
}

export const GET = withAuth(handleGetCurrentUser);
