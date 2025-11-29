import { NextRequest } from "next/server";
import { getDB } from "@/lib/cloudflare/d1";
import { reports, posts, comments, users, events } from "@/lib/db/schema";
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
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const reportSchema = z.object({
  targetType: z.enum(["user", "post", "comment", "message", "event"]),
  targetId: z.string().min(1, "Target ID is required"),
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "violence",
    "nudity",
    "false_information",
    "other",
  ]),
  description: z.string().max(1000).optional(),
});

// POST /api/v1/reports - Create a report
async function handleCreateReport(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || "Invalid report data",
        400
      );
    }

    const { targetType, targetId, reason, description } = parsed.data;
    const db = await getDB();

    // Verify target exists
    let targetExists = false;
    switch (targetType) {
      case "user":
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, targetId))
          .limit(1);
        targetExists = !!targetUser;
        break;
      case "post":
        const [targetPost] = await db
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.id, targetId))
          .limit(1);
        targetExists = !!targetPost;
        break;
      case "comment":
        const [targetComment] = await db
          .select({ id: comments.id })
          .from(comments)
          .where(eq(comments.id, targetId))
          .limit(1);
        targetExists = !!targetComment;
        break;
      case "event":
        const [targetEvent] = await db
          .select({ id: events.id })
          .from(events)
          .where(eq(events.id, targetId))
          .limit(1);
        targetExists = !!targetEvent;
        break;
      default:
        // For messages, we'll assume it exists (would need message validation)
        targetExists = true;
    }

    if (!targetExists) {
      return notFound(
        `${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`
      );
    }

    // Don't allow reporting yourself
    if (targetType === "user" && targetId === user.id) {
      return error(
        ErrorCodes.INVALID_REQUEST,
        "You cannot report yourself",
        400
      );
    }

    // Check for existing report from same user
    const [existing] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, user.id),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "pending")
        )
      )
      .limit(1);

    if (existing) {
      return error(
        ErrorCodes.ALREADY_EXISTS,
        "You have already reported this content",
        409
      );
    }

    // Create report
    const [report] = await db
      .insert(reports)
      .values({
        reporterId: user.id,
        targetType,
        targetId,
        reason,
        description: description || null,
      })
      .returning();

    return success({
      id: report.id,
      message:
        "Report submitted successfully. Our team will review it shortly.",
    });
  } catch (err) {
    logError(requestId, "create_report_error", err);
    return serverError("Failed to submit report");
  }
}

export const POST = withAuth(handleCreateReport);
