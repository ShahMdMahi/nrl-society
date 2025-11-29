import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { events, eventAttendees, notifications } from "@/lib/db/schema";
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
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

interface AttendParams {
  eventId: string;
}

const attendSchema = z.object({
  status: z.enum(["going", "interested", "not_going"]),
});

// POST /api/v1/events/[eventId]/attend - RSVP to event
async function handleAttend(
  request: NextRequest,
  { user, requestId }: ApiContext,
  params?: AttendParams
) {
  try {
    const eventId = params?.eventId;
    if (!eventId) {
      return notFound("Event");
    }

    const body = (await request.json()) as { status: string };
    const parsed = attendSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "Invalid status. Use 'going', 'interested', or 'not_going'",
        400
      );
    }

    const { status } = parsed.data;
    const db = await getDB();

    // Check if event exists
    const [event] = await db
      .select({
        id: events.id,
        creatorId: events.creatorId,
        maxAttendees: events.maxAttendees,
        title: events.title,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return notFound("Event");
    }

    // Check max attendees limit for "going" status
    if (status === "going" && event.maxAttendees) {
      const [currentCount] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(eventAttendees)
        .where(
          and(
            eq(eventAttendees.eventId, eventId),
            eq(eventAttendees.status, "going")
          )
        );

      if ((currentCount?.count ?? 0) >= event.maxAttendees) {
        return error(
          ErrorCodes.LIMIT_EXCEEDED,
          "Event has reached maximum attendees",
          400
        );
      }
    }

    // Check if already attending
    const [existing] = await db
      .select({ id: eventAttendees.id, status: eventAttendees.status })
      .from(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.userId, user.id)
        )
      )
      .limit(1);

    if (existing) {
      // Update status
      if (status === "not_going") {
        // Remove attendance
        await db
          .delete(eventAttendees)
          .where(eq(eventAttendees.id, existing.id));
      } else {
        await db
          .update(eventAttendees)
          .set({ status })
          .where(eq(eventAttendees.id, existing.id));
      }
    } else if (status !== "not_going") {
      // Create new attendance
      await db.insert(eventAttendees).values({
        eventId,
        userId: user.id,
        status,
      });

      // Notify event creator
      if (event.creatorId !== user.id) {
        await db.insert(notifications).values({
          userId: event.creatorId,
          type: "mention", // Using mention type for event notifications
          actorId: user.id,
          targetType: "event",
          targetId: eventId,
          content: `is ${status === "going" ? "attending" : "interested in"} your event "${event.title}"`,
        });
      }
    }

    // Get updated counts
    const [counts] = await db
      .select({
        going: sql<number>`count(case when ${eventAttendees.status} = 'going' then 1 end)`,
        interested: sql<number>`count(case when ${eventAttendees.status} = 'interested' then 1 end)`,
      })
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, eventId));

    return success({
      status: status === "not_going" ? null : status,
      attendeeCounts: {
        going: counts?.going ?? 0,
        interested: counts?.interested ?? 0,
      },
    });
  } catch (err) {
    logError(requestId, "event_attend_error", err);
    return serverError("Failed to update attendance");
  }
}

export const POST = withAuth((req: NextRequest, ctx: ApiContext) =>
  handleAttend(req, ctx, {
    eventId: req.url.split("/events/")[1]?.split("/")[0] || "",
  })
);
