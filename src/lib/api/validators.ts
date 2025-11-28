import { z } from "zod";

// Common validation patterns
const emailSchema = z.string().email("Invalid email address").toLowerCase();
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores",
  )
  .toLowerCase();
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters");
const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .max(50, "Display name must be at most 50 characters");

// Auth schemas
export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// User schemas
export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional().nullable(),
  coverUrl: z.string().url("Invalid cover URL").optional().nullable(),
  isPrivate: z.boolean().optional(),
});

// Post schemas
export const createPostSchema = z.object({
  content: z
    .string()
    .max(5000, "Post content must be at most 5000 characters")
    .optional(),
  mediaUrls: z
    .array(z.string().url())
    .max(10, "Maximum 10 media files")
    .optional(),
  visibility: z.enum(["public", "friends", "private"]).default("public"),
});

export const updatePostSchema = z.object({
  content: z
    .string()
    .max(5000, "Post content must be at most 5000 characters")
    .optional(),
  visibility: z.enum(["public", "friends", "private"]).optional(),
});

// Comment schemas
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be at most 2000 characters"),
  parentId: z.string().uuid().optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be at most 5000 characters")
    .optional(),
  mediaUrl: z.string().url().optional(),
});

export const createConversationSchema = z.object({
  participantIds: z
    .array(z.string().uuid())
    .min(1, "At least one participant is required"),
  type: z.enum(["direct", "group"]).default("direct"),
  name: z.string().max(100).optional(), // For group chats
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Search schemas
export const searchSchema = z.object({
  q: z.string().min(1, "Search query is required").max(100),
  ...paginationSchema.shape,
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;

/**
 * Helper to validate request body
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T; errors: null } | { data: null; errors: z.ZodIssue[] }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, errors: null };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { data: null, errors: err.issues };
    }
    throw err;
  }
}

/**
 * Helper to validate query params
 */
export function validateParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): { data: T; errors: null } | { data: null; errors: z.ZodIssue[] } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { data, errors: null };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { data: null, errors: err.issues };
    }
    throw err;
  }
}
