import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/api/avatar/$" as any)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return proxyAvatarRequest(request);
      },
      HEAD: async ({ request }) => {
        return proxyAvatarRequest(request);
      },
      OPTIONS: async ({ request }) => {
        return proxyAvatarRequest(request);
      },
    },
  },
});

async function proxyAvatarRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    const errorMsg = `API URL not configured. process.env.API_URL: ${process.env.API_URL}, NODE_ENV: ${process.env.NODE_ENV}`;
    console.error(`[Proxy] ${errorMsg}`);
    return new Response(
      JSON.stringify({
        error: "API URL not configured",
        message: "API_URL environment variable is not set in production",
        details: errorMsg,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Remove /api prefix from path
  const backendPath = path.replace(/^\/api/, "");
  const backendUrl = `${apiUrl}${backendPath}${url.search}`;
  console.log(`[Proxy] ${request.method} ${path} -> ${backendUrl}`);

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

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[Proxy] ${request.method} ${path} -> ${response.status} ${response.statusText} (from ${backendUrl})`);

    const responseHeaders = new Headers();
    const headersToSkip = ["content-encoding", "transfer-encoding", "content-length", "connection"];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!headersToSkip.includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await response.arrayBuffer();

    if (responseBody.byteLength > 0) {
      responseHeaders.set("Content-Length", responseBody.byteLength.toString());
    } else if (response.status === 200 && responseBody.byteLength === 0) {
      console.warn(`[Proxy] Empty response body for ${path} from ${backendUrl}`);
    }

    if (!response.ok) {
      const errorText = new TextDecoder().decode(responseBody);
      console.error(`[Proxy] Backend returned error for ${path}:`, response.status, errorText.substring(0, 200));
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] Fetch error for ${request.method} ${path} -> ${backendUrl}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            cause: error.cause,
            stack: error.stack?.split("\n").slice(0, 3).join("\n"),
          }
        : {};

    return new Response(
      JSON.stringify({
        error: "Failed to proxy request",
        message: errorMessage,
        backendUrl,
        path,
        details: errorDetails,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

