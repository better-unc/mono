import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/$" as any)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handleGitRequest(request);
      },
      POST: async ({ request }) => {
        return handleGitRequest(request);
      },
      OPTIONS: async ({ request }) => {
        return handleGitRequest(request);
      },
    },
  },
});

async function handleGitRequest(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const path = url.pathname;

  const gitPattern = /^\/[^/]+\/[^/]+\.git\//;
  if (!gitPattern.test(path)) {
    return undefined;
  }

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return new Response(JSON.stringify({ error: "API URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const backendUrl = `${apiUrl}${path}${url.search}`;
  console.log(`[Git Proxy] ${request.method} ${path} -> ${backendUrl}`);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
      headers.set(key, value);
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Git Proxy] Error for ${path}:`, error);
    return new Response(
      JSON.stringify({
        error: "Failed to proxy git request",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
