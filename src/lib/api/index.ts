// Response helpers
export {
  success,
  error,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError,
  rateLimitError,
  ErrorCodes,
} from "./response";
export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from "./response";

// Validation schemas
export {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  sendMessageSchema,
  createConversationSchema,
  paginationSchema,
  cursorPaginationSchema,
  searchSchema,
  validateBody,
  validateParams,
} from "./validators";
export type {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  SendMessageInput,
  CreateConversationInput,
  PaginationInput,
  CursorPaginationInput,
  SearchInput,
} from "./validators";

// Middleware and utilities
export {
  withAuth,
  withOptionalAuth,
  withRateLimit,
  parseBody,
  parseQuery,
  logError,
  logInfo,
  checkRateLimit,
} from "./middleware";
export type { ApiContext, OptionalApiContext } from "./middleware";
