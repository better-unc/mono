import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => proxyAuthRequest(request),
      POST: async ({ request }) => proxyAuthRequest(request),
      PUT: async ({ request }) => proxyAuthRequest(request),
      PATCH: async ({ request }) => proxyAuthRequest(request),
      DELETE: async ({ request }) => proxyAuthRequest(request),
      OPTIONS: async ({ request }) => proxyAuthRequest(request),
    },
  },
});

async function proxyAuthRequest(request: Request): Promise<Response> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return new Response(JSON.stringify({ error: "API URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const backendUrl = `${apiUrl}${url.pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
      headers.set(key, value);
    }
  });

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? await request.arrayBuffer()
    : undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    const headersToSkip = ["content-encoding", "transfer-encoding", "content-length", "connection"];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!headersToSkip.includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Auth Proxy] Error proxying request:`, error);
    return new Response(
      JSON.stringify({
        error: "Failed to proxy auth request",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
