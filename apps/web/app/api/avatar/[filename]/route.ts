import { NextRequest, NextResponse } from "next/server";
import { r2Get } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const rateLimitResult = rateLimit(request, "avatar", { limit: 200, windowMs: 60000 });
  if (!rateLimitResult.success) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() },
    });
  }

  const { filename } = await params;

  const key = `avatars/${filename}`;
  const data = await r2Get(key);

  if (!data) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  let contentType = "image/png";

  if (ext === "jpg" || ext === "jpeg") {
    contentType = "image/jpeg";
  } else if (ext === "gif") {
    contentType = "image/gif";
  } else if (ext === "webp") {
    contentType = "image/webp";
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
