import { NextRequest } from "next/server";
import { uploadFile, getPublicUrl } from "@/lib/cloudflare/r2";
import { getCurrentUser } from "@/lib/auth/session";
import { success, error } from "@/lib/api/response";

// Allowed file types and size limits
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/v1/upload - Upload a file
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("UNAUTHORIZED", "Please log in to upload files", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // avatar, cover, post, message

    if (!file) {
      return error("INVALID_REQUEST", "No file provided", 400);
    }

    if (!type) {
      return error("INVALID_REQUEST", "Upload type is required", 400);
    }

    const contentType = file.type;
    const fileSize = file.size;
    const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

    if (!isImage && !isVideo) {
      return error(
        "INVALID_FILE_TYPE",
        "File type not allowed. Allowed: JPEG, PNG, GIF, WebP images and MP4, WebM videos",
        400,
      );
    }

    // Check file size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return error(
        "FILE_TOO_LARGE",
        `File size exceeds ${maxSizeMB}MB limit`,
        400,
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
    const key = `${folder}/${currentUser.id}/${timestamp}-${randomId}.${extension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await uploadFile(key, arrayBuffer, {
      contentType,
      customMetadata: {
        userId: currentUser.id,
        type,
        originalName: file.name,
      },
    });

    // Generate public URL
    // In production, replace this with your actual R2 public URL or custom domain
    const publicUrl = getPublicUrl(key, process.env.PUBLIC_URL || "/media");

    return success({
      url: publicUrl,
      key,
      contentType,
      size: fileSize,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return error("INTERNAL_ERROR", "Failed to upload file", 500);
  }
}
