import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { notifications, users } from "@/lib/db/schema";
import {
  success,
  error,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";
import { eq, desc, and, sql } from "drizzle-orm";

// GET /api/v1/notifications - Get user notifications
async function handleGetNotifications(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const cursor = searchParams.get("cursor");
    const unreadOnly = searchParams.get("unread") === "true";

    const db = await getDB();

    // Build conditions
    const conditions = [eq(notifications.userId, user.id)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    if (cursor) {
      conditions.push(sql`${notifications.createdAt} < ${cursor}`);
    }

    // Get notifications with actor info
    const notificationList = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        content: notifications.content,
        targetType: notifications.targetType,
        targetId: notifications.targetId,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const hasMore = notificationList.length > limit;
    const items = hasMore ? notificationList.slice(0, -1) : notificationList;

    // Get unread count
    const [unreadCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, user.id), eq(notifications.isRead, false))
      );

    return success(
      items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      {
        cursor: hasMore
          ? items[items.length - 1].createdAt.toISOString()
          : undefined,
        hasMore,
        total: unreadCount?.count ?? 0,
      }
    );
  } catch (err) {
    logError(requestId, "get_notifications_error", err);
    return serverError("Failed to fetch notifications");
  }
}

// PUT /api/v1/notifications - Mark notifications as read
async function handleMarkNotificationsRead(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = (await request.json()) as { ids?: string[]; all?: boolean };
    const db = await getDB();

    if (body.all) {
      // Mark all notifications as read
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );

      return success({ message: "All notifications marked as read" });
    }

    if (body.ids && body.ids.length > 0) {
      // Mark specific notifications as read
      for (const id of body.ids) {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(
            and(eq(notifications.id, id), eq(notifications.userId, user.id))
          );
      }

      return success({ message: "Notifications marked as read" });
    }

    return error(
      "INVALID_REQUEST",
      "Provide notification IDs or set all to true",
      400
    );
  } catch (err) {
    logError(requestId, "mark_notifications_read_error", err);
    return serverError("Failed to mark notifications as read");
  }
}

// DELETE /api/v1/notifications - Delete notifications
async function handleDeleteNotifications(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all") === "true";

    const db = await getDB();

    if (all) {
      // Delete all notifications for user
      await db.delete(notifications).where(eq(notifications.userId, user.id));

      return success({ message: "All notifications deleted" });
    }

    if (id) {
      // Delete specific notification
      await db
        .delete(notifications)
        .where(
          and(eq(notifications.id, id), eq(notifications.userId, user.id))
        );

      return success({ message: "Notification deleted" });
    }

    return error(
      "INVALID_REQUEST",
      "Provide notification ID or set all to true",
      400
    );
  } catch (err) {
    logError(requestId, "delete_notifications_error", err);
    return serverError("Failed to delete notifications");
  }
}

export const GET = withAuth(handleGetNotifications);
export const PUT = withAuth(handleMarkNotificationsRead);
export const DELETE = withAuth(handleDeleteNotifications);
