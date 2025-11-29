import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { events, eventAttendees, users } from "@/lib/db/schema";
import {
  success,
  error,
  notFound,
  forbidden,
  serverError,
  ErrorCodes,
  withAuth,
  withOptionalAuth,
  parseBody,
  logError,
  ApiContext,
  OptionalApiContext,
} from "@/lib/api";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

interface EventParams {
  eventId: string;
}

// Validation schema for updating events
const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  locationType: z.enum(["in-person", "online", "hybrid"]).optional(),
  eventUrl: z.string().url().optional().nullable(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional()
    .nullable(),
  isPublic: z.boolean().optional(),
  maxAttendees: z.number().int().positive().optional().nullable(),
});

// GET /api/v1/events/[eventId] - Get single event
async function handleGetEvent(
  _request: NextRequest,
  { user, requestId }: OptionalApiContext,
  params?: EventParams
) {
  try {
    const eventId = params?.eventId;
    if (!eventId) {
      return notFound("Event");
    }

    const db = await getDB();

    // Get event with creator info
    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        coverImageUrl: events.coverImageUrl,
        location: events.location,
        locationType: events.locationType,
        eventUrl: events.eventUrl,
        startDate: events.startDate,
        endDate: events.endDate,
        isPublic: events.isPublic,
        maxAttendees: events.maxAttendees,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.creatorId, users.id))
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return notFound("Event");
    }

    // Check visibility
    if (!event.isPublic && event.creator.id !== user?.id) {
      return forbidden();
    }

    // Get attendee counts
    const [counts] = await db
      .select({
        going: sql<number>`count(case when ${eventAttendees.status} = 'going' then 1 end)`,
        interested: sql<number>`count(case when ${eventAttendees.status} = 'interested' then 1 end)`,
      })
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, eventId));

    // Get user's attendance status
    let userStatus = null;
    if (user) {
      const [attendance] = await db
        .select({ status: eventAttendees.status })
        .from(eventAttendees)
        .where(
          and(
            eq(eventAttendees.eventId, eventId),
            eq(eventAttendees.userId, user.id)
          )
        )
        .limit(1);
      userStatus = attendance?.status || null;
    }

    // Get some attendees
    const attendees = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        status: eventAttendees.status,
      })
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(eq(eventAttendees.eventId, eventId))
      .limit(10);

    return success({
      ...event,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString() || null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      attendeeCounts: {
        going: counts?.going ?? 0,
        interested: counts?.interested ?? 0,
      },
      userStatus,
      isCreator: user?.id === event.creator.id,
      attendees,
    });
  } catch (err) {
    logError(requestId, "get_event_error", err);
    return serverError("Failed to fetch event");
  }
}

// PUT /api/v1/events/[eventId] - Update event
async function handleUpdateEvent(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: EventParams
) {
  try {
    const eventId = params?.eventId;
    if (!eventId) {
      return notFound("Event");
    }

    const db = await getDB();

    // Check if event exists and user is creator
    const [event] = await db
      .select({ id: events.id, creatorId: events.creatorId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return notFound("Event");
    }

    if (event.creatorId !== user.id) {
      return forbidden();
    }

    const parsed = await parseBody(request, updateEventSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const updates = parsed.data;

    // Validate dates if provided
    if (updates.startDate && updates.startDate < new Date()) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "Start date must be in the future",
        400
      );
    }

    if (
      updates.endDate &&
      updates.startDate &&
      updates.endDate < updates.startDate
    ) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "End date must be after start date",
        400
      );
    }

    // Update event
    const [updated] = await db
      .update(events)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    return success({
      ...updated,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    logError(requestId, "update_event_error", err);
    return serverError("Failed to update event");
  }
}

// DELETE /api/v1/events/[eventId] - Delete event
async function handleDeleteEvent(
  _request: NextRequest,
  { user, requestId }: ApiContext,
  params?: EventParams
) {
  try {
    const eventId = params?.eventId;
    if (!eventId) {
      return notFound("Event");
    }

    const db = await getDB();

    // Check if event exists and user is creator
    const [event] = await db
      .select({ id: events.id, creatorId: events.creatorId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return notFound("Event");
    }

    if (event.creatorId !== user.id) {
      return forbidden();
    }

    // Delete event (attendees will be cascade deleted)
    await db.delete(events).where(eq(events.id, eventId));

    return success({ deleted: true });
  } catch (err) {
    logError(requestId, "delete_event_error", err);
    return serverError("Failed to delete event");
  }
}

export const GET = withOptionalAuth(
  (req: NextRequest, ctx: OptionalApiContext) =>
    handleGetEvent(req, ctx, {
      eventId: req.url.split("/events/")[1]?.split("/")[0]?.split("?")[0] || "",
    })
);

export const PUT = withAuth((req: NextRequest, ctx: ApiContext) =>
  handleUpdateEvent(req, ctx, {
    eventId: req.url.split("/events/")[1]?.split("/")[0]?.split("?")[0] || "",
  })
);

export const DELETE = withAuth((req: NextRequest, ctx: ApiContext) =>
  handleDeleteEvent(req, ctx, {
    eventId: req.url.split("/events/")[1]?.split("/")[0]?.split("?")[0] || "",
  })
);
