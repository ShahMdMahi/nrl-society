import { cookies } from "next/headers";
import { getDB } from "@/lib/cloudflare/d1";
import { kvGet, kvSet, kvDelete } from "@/lib/cloudflare/kv";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

const SESSION_COOKIE_NAME = "nrl_session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionData {
  userId: string;
  expiresAt: number;
}

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION * 1000;

  // Store session in KV for fast lookup
  await kvSet(
    `session:${sessionId}`,
    { userId, expiresAt },
    { expirationTtl: SESSION_DURATION }
  );

  // Also store in D1 for persistence
  const db = await getDB();
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: new Date(expiresAt),
  });

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });

  return sessionId;
}

/**
 * Get the current session from the request
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  // Try KV first (faster)
  const kvSession = await kvGet<SessionData>(`session:${sessionId}`, {
    type: "json",
  });

  if (kvSession) {
    if (kvSession.expiresAt < Date.now()) {
      // Session expired
      await invalidateSession(sessionId);
      return null;
    }
    return kvSession;
  }

  // Fallback to D1
  const db = await getDB();
  const [dbSession] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!dbSession) {
    return null;
  }

  // Re-cache in KV
  const sessionData: SessionData = {
    userId: dbSession.userId,
    expiresAt: dbSession.expiresAt.getTime(),
  };

  const ttl = Math.floor((dbSession.expiresAt.getTime() - Date.now()) / 1000);
  if (ttl > 0) {
    await kvSet(`session:${sessionId}`, sessionData, { expirationTtl: ttl });
  }

  return sessionData;
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Try cache first
  const cachedUser = await kvGet<SessionUser>(`user:${session.userId}`, {
    type: "json",
  });

  if (cachedUser) {
    return cachedUser;
  }

  // Fetch from database
  const db = await getDB();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified ?? false,
  };

  // Cache for 5 minutes
  await kvSet(`user:${session.userId}`, sessionUser, { expirationTtl: 300 });

  return sessionUser;
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(sessionId?: string): Promise<void> {
  const cookieStore = await cookies();

  if (!sessionId) {
    sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (sessionId) {
    // Delete from KV
    await kvDelete(`session:${sessionId}`);

    // Delete from D1
    const db = await getDB();
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  // Clear cookie
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Refresh the session expiration
 */
export async function refreshSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return;
  }

  const session = await getSession();
  if (!session) {
    return;
  }

  const newExpiresAt = Date.now() + SESSION_DURATION * 1000;

  // Update KV
  await kvSet(
    `session:${sessionId}`,
    { ...session, expiresAt: newExpiresAt },
    { expirationTtl: SESSION_DURATION }
  );

  // Update D1
  const db = await getDB();
  await db
    .update(sessions)
    .set({ expiresAt: new Date(newExpiresAt) })
    .where(eq(sessions.id, sessionId));

  // Refresh cookie
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

/**
 * Get session ID from Authorization header (for API/mobile)
 */
export function getSessionIdFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Validate session from Authorization header (for API routes)
 */
export async function validateApiSession(
  authHeader: string | null
): Promise<SessionData | null> {
  const sessionId = getSessionIdFromHeader(authHeader);

  if (!sessionId) {
    return null;
  }

  // Check KV first
  const session = await kvGet<SessionData>(`session:${sessionId}`, {
    type: "json",
  });

  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  // Check D1
  const db = await getDB();
  const [dbSession] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!dbSession) {
    return null;
  }

  return {
    userId: dbSession.userId,
    expiresAt: dbSession.expiresAt.getTime(),
  };
}

/**
 * Clear user cache (call after profile updates)
 */
export async function clearUserCache(userId: string): Promise<void> {
  await kvDelete(`user:${userId}`);
}
