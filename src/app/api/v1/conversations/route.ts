import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import {
  conversations,
  conversationParticipants,
  messages,
  users,
} from "@/lib/db/schema";
import {
  success,
  error,
  notFound,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

// GET /api/v1/conversations - List user's conversations
async function handleGetConversations(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const cursor = searchParams.get("cursor");

    const db = await getDB();

    // Get conversation IDs where user is participant
    const userConversations = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, user.id));

    const conversationIds = userConversations.map((c) => c.conversationId);

    if (conversationIds.length === 0) {
      return success([]);
    }

    // Get conversations with last message
    const conditions = [inArray(conversations.id, conversationIds)];
    if (cursor) {
      conditions.push(sql`${conversations.createdAt} < ${cursor}`);
    }

    const conversationList = await db
      .select({
        id: conversations.id,
        name: conversations.name,
        type: conversations.type,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.createdAt))
      .limit(limit + 1);

    const hasMore = conversationList.length > limit;
    const items = hasMore ? conversationList.slice(0, -1) : conversationList;

    // Get participants for each conversation
    const result = await Promise.all(
      items.map(async (conv) => {
        const participants = await db
          .select({
            userId: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          })
          .from(conversationParticipants)
          .innerJoin(users, eq(users.id, conversationParticipants.userId))
          .where(eq(conversationParticipants.conversationId, conv.id));

        // Get last message
        const [lastMessage] = await db
          .select({
            id: messages.id,
            content: messages.content,
            senderId: messages.senderId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          ...conv,
          isGroup: conv.type === "group",
          createdAt: conv.createdAt.toISOString(),
          participants: participants.filter((p) => p.userId !== user.id),
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
        };
      })
    );

    return success(result, {
      cursor: hasMore
        ? items[items.length - 1].createdAt.toISOString()
        : undefined,
      hasMore,
    });
  } catch (err) {
    logError(requestId, "get_conversations_error", err);
    return serverError("Failed to fetch conversations");
  }
}

// POST /api/v1/conversations - Create a new conversation
async function handleCreateConversation(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = (await request.json()) as {
      participantIds: string[];
      name?: string;
      isGroup?: boolean;
    };

    if (!body.participantIds || body.participantIds.length === 0) {
      return error(
        "INVALID_REQUEST",
        "At least one participant is required",
        400
      );
    }

    // Remove duplicates and current user from participants
    const uniqueParticipants = [...new Set(body.participantIds)].filter(
      (id) => id !== user.id
    );

    if (uniqueParticipants.length === 0) {
      return error(
        "INVALID_REQUEST",
        "Cannot create conversation with only yourself",
        400
      );
    }

    const db = await getDB();

    // Check if participants exist
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, uniqueParticipants));

    if (existingUsers.length !== uniqueParticipants.length) {
      return notFound("One or more participants");
    }

    // For 1-on-1 conversations, check if one already exists
    if (uniqueParticipants.length === 1 && !body.isGroup) {
      const existingConversation = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .innerJoin(
          conversations,
          and(
            eq(conversations.id, conversationParticipants.conversationId),
            eq(conversations.type, "direct")
          )
        )
        .where(
          inArray(conversationParticipants.userId, [
            user.id,
            uniqueParticipants[0],
          ])
        )
        .groupBy(conversationParticipants.conversationId)
        .having(sql`count(${conversationParticipants.userId}) = 2`);

      if (existingConversation.length > 0) {
        return success({
          conversationId: existingConversation[0].conversationId,
          existing: true,
        });
      }
    }

    // Create conversation
    const conversationId = crypto.randomUUID();
    const isGroup = body.isGroup || uniqueParticipants.length > 1;

    await db.insert(conversations).values({
      id: conversationId,
      name: body.name || null,
      type: isGroup ? "group" : "direct",
    });

    // Add all participants including current user
    const allParticipants = [user.id, ...uniqueParticipants];
    for (const participantId of allParticipants) {
      await db.insert(conversationParticipants).values({
        conversationId,
        userId: participantId,
      });
    }

    return success({
      conversationId,
      existing: false,
    });
  } catch (err) {
    logError(requestId, "create_conversation_error", err);
    return serverError("Failed to create conversation");
  }
}

export const GET = withAuth(handleGetConversations);
export const POST = withAuth(handleCreateConversation);
