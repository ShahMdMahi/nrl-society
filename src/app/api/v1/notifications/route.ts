import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { notifications, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";
import { eq, desc, and, sql } from "drizzle-orm";

// GET /api/v1/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to view notifications", 401);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");
    const unreadOnly = searchParams.get("unread") === "true";

    const db = await getDB();

    // Build conditions
    const conditions = [eq(notifications.userId, currentUser.id)];
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
        and(
          eq(notifications.userId, currentUser.id),
          eq(notifications.isRead, false),
        ),
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
      },
    );
  } catch (err) {
    console.error("Get notifications error:", err);
    return error("INTERNAL_ERROR", "Failed to fetch notifications", 500);
  }
}

// PUT /api/v1/notifications - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error(
        "UNAUTHORIZED",
        "Please log in to manage notifications",
        401,
      );
    }

    const body = (await request.json()) as { ids?: string[]; all?: boolean };
    const db = await getDB();

    if (body.all) {
      // Mark all notifications as read
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, currentUser.id),
            eq(notifications.isRead, false),
          ),
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
            and(
              eq(notifications.id, id),
              eq(notifications.userId, currentUser.id),
            ),
          );
      }

      return success({ message: "Notifications marked as read" });
    }

    return error(
      "INVALID_REQUEST",
      "Provide notification IDs or set all to true",
      400,
    );
  } catch (err) {
    console.error("Mark notifications read error:", err);
    return error("INTERNAL_ERROR", "Failed to mark notifications as read", 500);
  }
}

// DELETE /api/v1/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error(
        "UNAUTHORIZED",
        "Please log in to manage notifications",
        401,
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all") === "true";

    const db = await getDB();

    if (all) {
      // Delete all notifications for user
      await db
        .delete(notifications)
        .where(eq(notifications.userId, currentUser.id));

      return success({ message: "All notifications deleted" });
    }

    if (id) {
      // Delete specific notification
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, currentUser.id),
          ),
        );

      return success({ message: "Notification deleted" });
    }

    return error(
      "INVALID_REQUEST",
      "Provide notification ID or set all to true",
      400,
    );
  } catch (err) {
    console.error("Delete notifications error:", err);
    return error("INTERNAL_ERROR", "Failed to delete notifications", 500);
  }
}
