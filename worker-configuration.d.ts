// Cloudflare Worker types for this project
// This file defines the custom bindings for this application

import "@cloudflare/workers-types";

// Define our application-specific environment interface
export interface AppEnv {
  // D1 Databases
  DB: D1Database;
  NEXT_TAG_CACHE_D1?: D1Database;

  // KV Namespaces
  SESSIONS_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  NEXT_INC_CACHE_KV?: KVNamespace;

  // R2 Buckets
  MEDIA_BUCKET: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;

  // Durable Objects
  CHAT_ROOMS: DurableObjectNamespace;
  NOTIFICATION_HUB: DurableObjectNamespace;
  NEXT_CACHE_DO_QUEUE?: DurableObjectNamespace;

  // Services
  WORKER_SELF_REFERENCE?: Fetcher;
  ASSETS?: Fetcher;

  // Environment variables
  NODE_ENV?: string;
  PUBLIC_URL?: string;
  NEXTJS_ENV?: string;
}
