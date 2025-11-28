import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "@/../worker-configuration";

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let db: DrizzleDB | null = null;

/**
 * Get the Drizzle database instance connected to Cloudflare D1
 * Uses singleton pattern for efficiency
 */
export async function getDB(): Promise<DrizzleDB> {
  if (db) return db;

  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  db = drizzle(appEnv.DB, { schema });
  return db;
}

/**
 * Execute a raw SQL query on D1
 * Useful for migrations or complex queries
 */
export async function executeRawSQL(sql: string, params?: unknown[]) {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  const stmt = appEnv.DB.prepare(sql);
  if (params && params.length > 0) {
    return stmt.bind(...params).run();
  }
  return stmt.run();
}

/**
 * Batch execute multiple SQL statements
 */
export async function batchExecute(statements: D1PreparedStatement[]) {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  return appEnv.DB.batch(statements);
}
