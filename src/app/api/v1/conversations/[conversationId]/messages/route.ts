import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { conversationParticipants, messages, users } from "@/lib/db/schema";
import {
  success,
  error,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, desc, and, sql } from "drizzle-orm";

interface RouteParams {
  conversationId: string;
}

// GET /api/v1/conversations/:conversationId/messages - Get messages
async function handleGetMessages(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: RouteParams
) {
  try {
    const conversationId = params?.conversationId;
    if (!conversationId) {
      return error("INVALID_REQUEST", "Conversation ID is required", 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const cursor = searchParams.get("cursor");

    const db = await getDB();

    // Check if user is participant
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (!participant) {
      return error(
        "FORBIDDEN",
        "You are not a participant of this conversation",
        403
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
        isOwn: m.sender.id === user.id,
      })),
      {
        cursor: hasMore ? items[0].createdAt.toISOString() : undefined,
        hasMore,
      }
    );
  } catch (err) {
    logError(requestId, "get_messages_error", err);
    return serverError("Failed to fetch messages");
  }
}

// POST /api/v1/conversations/:conversationId/messages - Send a message
async function handleSendMessage(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: RouteParams
) {
  try {
    const conversationId = params?.conversationId;
    if (!conversationId) {
      return error("INVALID_REQUEST", "Conversation ID is required", 400);
    }

    const body = (await request.json()) as {
      content: string;
      mediaUrl?: string;
    };

    if (!body.content?.trim() && !body.mediaUrl) {
      return error(
        "INVALID_REQUEST",
        "Message content or media is required",
        400
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
          eq(conversationParticipants.userId, user.id)
        )
      )
      .limit(1);

    if (!participant) {
      return error(
        "FORBIDDEN",
        "You are not a participant of this conversation",
        403
      );
    }

    // Create message
    const messageId = crypto.randomUUID();

    await db.insert(messages).values({
      id: messageId,
      conversationId,
      senderId: user.id,
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
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      isOwn: true,
    });
  } catch (err) {
    logError(requestId, "send_message_error", err);
    return serverError("Failed to send message");
  }
}

export const GET = withAuth<RouteParams>(handleGetMessages);
export const POST = withAuth<RouteParams>(handleSendMessage);
