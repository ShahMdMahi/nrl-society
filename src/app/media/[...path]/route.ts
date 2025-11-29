import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/cloudflare/r2";

interface MediaParams {
  path: string[];
}

// GET /media/[...path] - Serve media files from R2
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<MediaParams> }
) {
  try {
    const { path } = await params;
    const key = path.join("/");

    if (!key) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const object = await getFile(key);

    if (!object) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers = new Headers();

    // Set content type from R2 metadata or guess from extension
    const contentType = object.httpMetadata?.contentType || getContentType(key);
    headers.set("Content-Type", contentType);

    // Cache for 1 year (immutable content)
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Set content length if available
    if (object.size) {
      headers.set("Content-Length", object.size.toString());
    }

    // Return the file
    return new NextResponse(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error serving media:", error);
    return NextResponse.json(
      { error: "Failed to serve media" },
      { status: 500 }
    );
  }
}

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    pdf: "application/pdf",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
