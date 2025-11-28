import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "@/../worker-configuration";

/**
 * KV wrapper for session and cache operations
 */

export interface KVOptions {
  expirationTtl?: number; // Time to live in seconds
  expiration?: number; // Unix timestamp when the key should expire
}

/**
 * Get a value from KV by key
 */
export async function kvGet<T = string>(
  key: string,
  options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }
): Promise<T | null> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;

  if (options?.type === "json") {
    return appEnv.SESSIONS_KV.get(key, { type: "json" });
  }

  const value = await appEnv.SESSIONS_KV.get(key);
  return value as T | null;
}

/**
 * Set a value in KV
 */
export async function kvSet(
  key: string,
  value: string | object,
  options?: KVOptions
): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;

  const strValue = typeof value === "object" ? JSON.stringify(value) : value;

  await appEnv.SESSIONS_KV.put(key, strValue, {
    expirationTtl: options?.expirationTtl,
    expiration: options?.expiration,
  });
}

/**
 * Delete a key from KV
 */
export async function kvDelete(key: string): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  await appEnv.SESSIONS_KV.delete(key);
}

/**
 * List keys with optional prefix
 */
export async function kvList(options?: {
  prefix?: string;
  limit?: number;
  cursor?: string;
}): Promise<KVNamespaceListResult<unknown>> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  return appEnv.SESSIONS_KV.list(options);
}

// Cache-specific operations using CACHE_KV
export async function cacheGet<T = string>(key: string): Promise<T | null> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  const value = await appEnv.CACHE_KV.get(key, { type: "json" });
  return value as T | null;
}

export async function cacheSet(
  key: string,
  value: object,
  ttlSeconds: number = 3600
): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  await appEnv.CACHE_KV.put(key, JSON.stringify(value), {
    expirationTtl: ttlSeconds,
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  await appEnv.CACHE_KV.delete(key);
}
