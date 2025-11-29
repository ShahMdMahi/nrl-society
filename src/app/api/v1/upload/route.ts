import { NextRequest } from "next/server";
import { uploadFile, getPublicUrl } from "@/lib/cloudflare/r2";
import {
  success,
  error,
  serverError,
  withAuth,
  logError,
  ApiContext,
} from "@/lib/api";

// Allowed file types and size limits
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const VALID_UPLOAD_TYPES = ["avatar", "cover", "post", "message"] as const;
type UploadType = (typeof VALID_UPLOAD_TYPES)[number];

function isValidUploadType(type: string): type is UploadType {
  return VALID_UPLOAD_TYPES.includes(type as UploadType);
}

// POST /api/v1/upload - Upload a file
async function handleUpload(
  request: NextRequest,
  { user, requestId }: ApiContext
) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return error("INVALID_REQUEST", "No file provided", 400);
    }

    if (!type || !isValidUploadType(type)) {
      return error(
        "INVALID_REQUEST",
        "Upload type is required (avatar, cover, post, or message)",
        400
      );
    }

    const contentType = file.type;
    const fileSize = file.size;
    const isImage = ALLOWED_IMAGE_TYPES.includes(
      contentType as (typeof ALLOWED_IMAGE_TYPES)[number]
    );
    const isVideo = ALLOWED_VIDEO_TYPES.includes(
      contentType as (typeof ALLOWED_VIDEO_TYPES)[number]
    );

    if (!isImage && !isVideo) {
      return error(
        "INVALID_FILE_TYPE",
        "File type not allowed. Allowed: JPEG, PNG, GIF, WebP images and MP4, WebM videos",
        400
      );
    }

    // Check file size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return error(
        "FILE_TOO_LARGE",
        `File size exceeds ${maxSizeMB}MB limit`,
        400
      );
    }

    // Generate unique key for the file
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop() || (isImage ? "jpg" : "mp4");
    const folder =
      type === "avatar" || type === "cover"
        ? "profiles"
        : type === "message"
          ? "messages"
          : "posts";
    const key = `${folder}/${user.id}/${timestamp}-${randomId}.${extension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await uploadFile(key, arrayBuffer, {
      contentType,
      customMetadata: {
        userId: user.id,
        type,
        originalName: file.name,
      },
    });

    // Generate public URL
    const publicUrl = getPublicUrl(key, process.env.PUBLIC_URL || "/media");

    return success({
      url: publicUrl,
      key,
      contentType,
      size: fileSize,
    });
  } catch (err) {
    logError(requestId, "upload_error", err);
    return serverError("Failed to upload file");
  }
}

export const POST = withAuth(handleUpload);
