import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { conversationParticipants, messages, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, desc, and, sql } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

// GET /api/v1/conversations/:conversationId/messages - Get messages
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to view messages", 401);
    }

    const { conversationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");

    const db = await getDB();

    // Check if user is participant
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, currentUser.id),
        ),
      )
      .limit(1);

    if (!participant) {
      return error(
        "FORBIDDEN",
        "You are not a participant of this conversation",
        403,
      );
    }

    // Build conditions
    const conditions = [eq(messages.conversationId, conversationId)];
    if (cursor) {
      conditions.push(sql`${messages.createdAt} < ${cursor}`);
    }

    // Get messages
    const messageList = await db
      .select({
        id: messages.id,
        content: messages.content,
        mediaUrl: messages.mediaUrl,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        sender: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = messageList.length > limit;
    const items = hasMore ? messageList.slice(0, -1) : messageList;

    // Reverse to get chronological order
    const chronologicalItems = items.reverse();

    return success(
      chronologicalItems.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        isOwn: m.sender.id === currentUser.id,
      })),
      {
        cursor: hasMore ? items[0].createdAt.toISOString() : undefined,
        hasMore,
      },
    );
  } catch (err) {
    console.error("Get messages error:", err);
    return error("INTERNAL_ERROR", "Failed to fetch messages", 500);
  }
}

// POST /api/v1/conversations/:conversationId/messages - Send a message
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to send messages", 401);
    }

    const { conversationId } = await context.params;
    const body = (await request.json()) as {
      content: string;
      mediaUrl?: string;
    };

    if (!body.content?.trim() && !body.mediaUrl) {
      return error(
        "INVALID_REQUEST",
        "Message content or media is required",
        400,
      );
    }

    const db = await getDB();

    // Check if user is participant
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, currentUser.id),
        ),
      )
      .limit(1);

    if (!participant) {
      return error(
        "FORBIDDEN",
        "You are not a participant of this conversation",
        403,
      );
    }

    // Create message
    const messageId = crypto.randomUUID();

    await db.insert(messages).values({
      id: messageId,
      conversationId,
      senderId: currentUser.id,
      content: body.content?.trim() || null,
      mediaUrl: body.mediaUrl || null,
    });

    // Get the created message
    const [message] = await db
      .select({
        id: messages.id,
        content: messages.content,
        mediaUrl: messages.mediaUrl,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    return success({
      ...message,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: currentUser.id,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
      },
      isOwn: true,
    });
  } catch (err) {
    console.error("Send message error:", err);
    return error("INTERNAL_ERROR", "Failed to send message", 500);
  }
}
