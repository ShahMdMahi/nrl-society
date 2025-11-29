import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { events, eventAttendees, users } from "@/lib/db/schema";
import {
  success,
  error,
  notFound,
  serverError,
  ErrorCodes,
  withAuth,
  withOptionalAuth,
  parseBody,
  logError,
  ApiContext,
  OptionalApiContext,
} from "@/lib/api";
import { eq, and, desc, gte, sql, or } from "drizzle-orm";
import { z } from "zod";

// Validation schema for creating/updating events
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  location: z.string().max(500).optional(),
  locationType: z.enum(["in-person", "online", "hybrid"]).default("in-person"),
  eventUrl: z.string().url().optional().nullable(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional()
    .nullable(),
  isPublic: z.boolean().default(true),
  maxAttendees: z.number().int().positive().optional().nullable(),
});

// GET /api/v1/events - List events
async function handleGetEvents(
  request: NextRequest,
  { user, requestId }: OptionalApiContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "upcoming"; // upcoming, past, my, attending
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor");

    const db = await getDB();
    const now = new Date();

    let eventsList;

    if (filter === "my" && user) {
      // Get events created by user
      eventsList = await db
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
          creator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(events)
        .innerJoin(users, eq(events.creatorId, users.id))
        .where(eq(events.creatorId, user.id))
        .orderBy(desc(events.startDate))
        .limit(limit + 1);
    } else if (filter === "attending" && user) {
      // Get events user is attending
      eventsList = await db
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
          creator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
          attendeeStatus: eventAttendees.status,
        })
        .from(eventAttendees)
        .innerJoin(events, eq(eventAttendees.eventId, events.id))
        .innerJoin(users, eq(events.creatorId, users.id))
        .where(
          and(
            eq(eventAttendees.userId, user.id),
            or(
              eq(eventAttendees.status, "going"),
              eq(eventAttendees.status, "interested")
            )
          )
        )
        .orderBy(desc(events.startDate))
        .limit(limit + 1);
    } else if (filter === "past") {
      // Get past public events
      const conditions = [
        eq(events.isPublic, true),
        sql`${events.startDate} < ${now.getTime() / 1000}`,
      ];
      if (cursor) {
        conditions.push(sql`${events.startDate} < ${parseInt(cursor)}`);
      }

      eventsList = await db
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
          creator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(events)
        .innerJoin(users, eq(events.creatorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(events.startDate))
        .limit(limit + 1);
    } else {
      // Get upcoming public events
      const conditions = [
        eq(events.isPublic, true),
        gte(events.startDate, now),
      ];
      if (cursor) {
        conditions.push(sql`${events.startDate} > ${parseInt(cursor)}`);
      }

      eventsList = await db
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
          creator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(events)
        .innerJoin(users, eq(events.creatorId, users.id))
        .where(and(...conditions))
        .orderBy(events.startDate)
        .limit(limit + 1);
    }

    const hasMore = eventsList.length > limit;
    const items = hasMore ? eventsList.slice(0, -1) : eventsList;

    // Get attendee counts for each event
    const eventsWithCounts = await Promise.all(
      items.map(async (event) => {
        const [counts] = await db
          .select({
            going: sql<number>`count(case when ${eventAttendees.status} = 'going' then 1 end)`,
            interested: sql<number>`count(case when ${eventAttendees.status} = 'interested' then 1 end)`,
          })
          .from(eventAttendees)
          .where(eq(eventAttendees.eventId, event.id));

        let userStatus = null;
        if (user) {
          const [attendance] = await db
            .select({ status: eventAttendees.status })
            .from(eventAttendees)
            .where(
              and(
                eq(eventAttendees.eventId, event.id),
                eq(eventAttendees.userId, user.id)
              )
            )
            .limit(1);
          userStatus = attendance?.status || null;
        }

        return {
          ...event,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate?.toISOString() || null,
          createdAt: event.createdAt.toISOString(),
          attendeeCounts: {
            going: counts?.going ?? 0,
            interested: counts?.interested ?? 0,
          },
          userStatus,
          isCreator: user?.id === event.creator.id,
        };
      })
    );

    return success(eventsWithCounts, {
      cursor: hasMore
        ? items[items.length - 1].startDate.getTime().toString()
        : undefined,
      hasMore,
    });
  } catch (err) {
    logError(requestId, "get_events_error", err);
    return serverError("Failed to fetch events");
  }
}

// POST /api/v1/events - Create event
async function handleCreateEvent(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const parsed = await parseBody(request, createEventSchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const {
      title,
      description,
      coverImageUrl,
      location,
      locationType,
      eventUrl,
      startDate,
      endDate,
      isPublic,
      maxAttendees,
    } = parsed.data;

    // Validate dates
    if (startDate < new Date()) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "Start date must be in the future",
        400
      );
    }

    if (endDate && endDate < startDate) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "End date must be after start date",
        400
      );
    }

    const db = await getDB();

    // Create event
    const [event] = await db
      .insert(events)
      .values({
        creatorId: user.id,
        title,
        description: description || null,
        coverImageUrl: coverImageUrl || null,
        location: location || null,
        locationType,
        eventUrl: eventUrl || null,
        startDate,
        endDate: endDate || null,
        isPublic,
        maxAttendees: maxAttendees || null,
      })
      .returning();

    // Auto-add creator as "going"
    await db.insert(eventAttendees).values({
      eventId: event.id,
      userId: user.id,
      status: "going",
    });

    return success({
      ...event,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString() || null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    });
  } catch (err) {
    logError(requestId, "create_event_error", err);
    return serverError("Failed to create event");
  }
}

export const GET = withOptionalAuth(handleGetEvents);
export const POST = withAuth(handleCreateEvent);
