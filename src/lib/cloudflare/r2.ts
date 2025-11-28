import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "@/../worker-configuration";

/**
 * R2 wrapper for media file operations
 */

export interface UploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // Seconds until the URL expires (default: 3600)
}

/**
 * Upload a file to R2
 * @param key - The object key (path) in the bucket
 * @param data - The file data to upload
 * @param options - Upload options including content type
 */
export async function uploadFile(
  key: string,
  data: ArrayBuffer | ReadableStream | string,
  options?: UploadOptions
): Promise<R2Object> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;

  const result = await appEnv.MEDIA_BUCKET.put(key, data, {
    httpMetadata: options?.contentType
      ? { contentType: options.contentType }
      : undefined,
    customMetadata: options?.customMetadata,
  });

  if (!result) {
    throw new Error("Failed to upload file to R2");
  }

  return result;
}

/**
 * Get a file from R2
 * @param key - The object key to retrieve
 */
export async function getFile(key: string): Promise<R2ObjectBody | null> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  return appEnv.MEDIA_BUCKET.get(key);
}

/**
 * Delete a file from R2
 * @param key - The object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  await appEnv.MEDIA_BUCKET.delete(key);
}

/**
 * Delete multiple files from R2
 * @param keys - Array of object keys to delete
 */
export async function deleteFiles(keys: string[]): Promise<void> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  await appEnv.MEDIA_BUCKET.delete(keys);
}

/**
 * List files in R2 bucket
 */
export async function listFiles(options?: {
  prefix?: string;
  limit?: number;
  cursor?: string;
}): Promise<R2Objects> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  return appEnv.MEDIA_BUCKET.list(options);
}

/**
 * Check if a file exists in R2
 * @param key - The object key to check
 */
export async function fileExists(key: string): Promise<boolean> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  const head = await appEnv.MEDIA_BUCKET.head(key);
  return head !== null;
}

/**
 * Get file metadata without downloading the file
 * @param key - The object key
 */
export async function getFileMetadata(key: string): Promise<R2Object | null> {
  const { env } = await getCloudflareContext();
  const appEnv = env as AppEnv;
  return appEnv.MEDIA_BUCKET.head(key);
}

/**
 * Generate a public URL for a file
 * Note: Requires R2 bucket to have public access enabled or use a custom domain
 * @param key - The object key
 * @param bucketUrl - The public bucket URL or custom domain
 */
export function getPublicUrl(key: string, bucketUrl: string): string {
  return `${bucketUrl}/${key}`;
}

/**
 * Generate a unique file key with timestamp and random suffix
 * @param userId - The user ID uploading the file
 * @param fileName - Original filename
 * @param folder - Optional folder prefix (e.g., 'avatars', 'posts')
 */
export function generateFileKey(
  userId: string,
  fileName: string,
  folder?: string
): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const extension = fileName.split(".").pop() || "";
  const baseName = fileName.replace(/\.[^/.]+$/, "").slice(0, 32);

  const key = `${baseName}-${timestamp}-${randomSuffix}.${extension}`;

  if (folder) {
    return `${folder}/${userId}/${key}`;
  }

  return `${userId}/${key}`;
}

/**
 * Validate file type for uploads
 */
export function validateFileType(
  contentType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some((type) => {
    if (type.endsWith("/*")) {
      const baseType = type.slice(0, -2);
      return contentType.startsWith(baseType);
    }
    return contentType === type;
  });
}

// Common allowed file types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
];

// Max file sizes (in bytes)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
