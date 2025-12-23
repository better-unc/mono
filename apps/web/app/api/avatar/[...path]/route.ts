import { NextRequest, NextResponse } from "next/server";

const workerUrl = process.env.WORKER_URL || "http://localhost:8787";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const filename = path.join("/");
  const url = `${workerUrl}/avatar/${filename}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ error: "Avatar not found" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Avatar proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch avatar" }, { status: 500 });
  }
}
