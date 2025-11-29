import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { blocks, users, friendships } from "@/lib/db/schema";
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
import { eq, and, or, desc } from "drizzle-orm";

// GET /api/v1/blocks - Get blocked users
async function handleGetBlocks(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const db = await getDB();

    const blockedUsers = await db
      .select({
        id: blocks.id,
        blockedAt: blocks.createdAt,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(blocks)
      .innerJoin(users, eq(blocks.blockedId, users.id))
      .where(eq(blocks.blockerId, user.id))
      .orderBy(desc(blocks.createdAt))
      .limit(limit)
      .offset(offset);

    return success(
      blockedUsers.map((b) => ({
        ...b,
        blockedAt: b.blockedAt.toISOString(),
      }))
    );
  } catch (err) {
    logError(requestId, "get_blocks_error", err);
    return serverError("Failed to fetch blocked users");
  }
}

// POST /api/v1/blocks - Block a user
async function handleBlockUser(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = (await request.json()) as { userId: string };
    const { userId } = body;

    if (!userId) {
      return error(ErrorCodes.INVALID_REQUEST, "User ID is required", 400);
    }

    if (userId === user.id) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "You cannot block yourself",
        400
      );
    }

    const db = await getDB();

    // Check if user exists
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return notFound("User");
    }

    // Check if already blocked
    const [existing] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, userId)))
      .limit(1);

    if (existing) {
      return error(ErrorCodes.ALREADY_EXISTS, "User is already blocked", 409);
    }

    // Block user
    await db.insert(blocks).values({
      blockerId: user.id,
      blockedId: userId,
    });

    // Also remove any existing friendships
    await db
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.addresseeId, userId)
          ),
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, user.id)
          )
        )
      );

    return success({ blocked: true });
  } catch (err) {
    logError(requestId, "block_user_error", err);
    return serverError("Failed to block user");
  }
}

// DELETE /api/v1/blocks - Unblock a user
async function handleUnblockUser(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return error(ErrorCodes.INVALID_REQUEST, "User ID is required", 400);
    }

    const db = await getDB();

    // Check if blocked
    const [block] = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, userId)))
      .limit(1);

    if (!block) {
      return error(ErrorCodes.NOT_FOUND, "User is not blocked", 404);
    }

    // Unblock user
    await db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, userId)));

    return success({ blocked: false });
  } catch (err) {
    logError(requestId, "unblock_user_error", err);
    return serverError("Failed to unblock user");
  }
}

export const GET = withAuth(handleGetBlocks);
export const POST = withAuth(handleBlockUser);
export const DELETE = withAuth(handleUnblockUser);
